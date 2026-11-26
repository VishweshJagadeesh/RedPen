/** Loads a section's finalised work from the database into the pure diagnosis dataset shape. */
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import type { AssessmentType, MistakeType } from "../domain";
import type { SectionDataset } from "../diagnosis/dataset";
import { isoDate } from "../format";
import { effectiveMarks } from "../grading/review-items";

export { effectiveMarks };

export function shortTitleOf(title: string, type: string): string {
  const m = title.match(/^(Weekly Test|Periodic Test|Term Exam)\s+(\d+)/i);
  if (m) return `${m[1].split(" ").map((w) => w[0].toUpperCase()).join("")}${m[2]}`;
  if (type === "exit_ticket") return "Exit ticket";
  if (type === "remedial") return "Remedial";
  return title.length > 14 ? `${title.slice(0, 13)}…` : title;
}

/**
 * Cheap change detector for a section's finalised work: if none of these move, the dataset is the same.
 * (Covers finalising, overrides/re-scans after finalising, remedial assignments, and demo resets.)
 */
async function datasetFingerprint(sectionId: string) {
  const finalGrades = { submission: { assessment: { sectionId, status: "final" } } };
  const [asm, grades, overridden, remedials] = await Promise.all([
    prisma.assessment.aggregate({ where: { sectionId, status: "final" }, _count: { _all: true }, _max: { finalizedAt: true } }),
    prisma.answerGrade.aggregate({ where: finalGrades, _count: { _all: true }, _max: { reviewedAt: true }, _sum: { awardedMarks: true } }),
    prisma.answerGrade.aggregate({ where: { ...finalGrades, status: "overridden" }, _count: { _all: true }, _sum: { teacherMarks: true } }),
    prisma.remedialAssignment.aggregate({ where: { sectionId }, _count: { _all: true }, _max: { assignedAt: true } }),
  ]);
  return JSON.stringify([asm, grades, overridden, remedials]);
}

// Per-process cache (a warm serverless instance keeps it between requests). Keyed by the fingerprint, so a
// change in the database is picked up on the next request; stale entries are simply replaced.
const datasetCache = new Map<string, { fingerprint: string; ds: SectionDataset }>();

export async function loadSectionDataset(sectionId: string, opts: { includeAssessmentIds?: string[] } = {}): Promise<SectionDataset> {
  if (opts.includeAssessmentIds?.length) return readSectionDataset(sectionId, opts);
  const fingerprint = await datasetFingerprint(sectionId);
  const hit = datasetCache.get(sectionId);
  if (hit && hit.fingerprint === fingerprint) return hit.ds;
  const ds = await readSectionDataset(sectionId, opts);
  datasetCache.set(sectionId, { fingerprint, ds });
  return ds;
}

async function readSectionDataset(sectionId: string, opts: { includeAssessmentIds?: string[] } = {}): Promise<SectionDataset> {
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
  const [students, concepts, assessments, remedials] = await Promise.all([
    prisma.student.findMany({ where: { sectionId }, orderBy: { rollNumber: "asc" } }),
    prisma.concept.findMany({ where: { gradeLevel: section.grade, parentId: null }, orderBy: { order: "asc" } }),
    prisma.assessment.findMany({
      where: { sectionId, OR: [{ status: "final" }, ...(opts.includeAssessmentIds?.length ? [{ id: { in: opts.includeAssessmentIds } }] : [])] },
      orderBy: { date: "asc" },
      // Only what the diagnosis needs: the full grade rows (crops, signals, passes, reasoning) are ~10× larger.
      include: {
        questions: { orderBy: { number: "asc" }, select: { id: true, number: true, maxMarks: true, conceptIds: true } },
        submissions: {
          select: {
            studentId: true,
            status: true,
            answerGrades: {
              select: { questionId: true, status: true, awardedMarks: true, teacherMarks: true, maxMarks: true, mistakeType: true, misconception: true, transcription: true },
            },
          },
        },
      },
    }),
    prisma.remedialAssignment.findMany({ where: { sectionId } }),
  ]);

  return {
    sectionId,
    sectionName: section.name,
    students: students.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })),
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, chapter: c.chapter })),
    assessments: assessments.map((a) => {
      const remedial = a.remedialAssignmentId ? remedials.find((r) => r.id === a.remedialAssignmentId) : undefined;
      return {
        id: a.id,
        title: a.title,
        shortTitle: shortTitleOf(a.title, a.type),
        type: a.type as AssessmentType,
        date: isoDate(a.date),
        questions: a.questions.map((q) => ({ id: q.id, number: q.number, maxMarks: q.maxMarks, conceptIds: parseJson<string[]>(q.conceptIds, []) })),
        expectedStudentIds: remedial ? parseJson<string[]>(remedial.studentIds, []) : undefined,
      };
    }),
    submissions: assessments.flatMap((a) =>
      a.submissions
        .filter((s) => s.studentId)
        .map((s) => ({
          assessmentId: a.id,
          studentId: s.studentId!,
          absent: s.status === "absent",
          answers: s.answerGrades.map((g) => ({
            questionId: g.questionId,
            marks: effectiveMarks(g),
            maxMarks: g.maxMarks,
            mistakeType: g.mistakeType as MistakeType,
            misconception: g.misconception,
            transcription: g.transcription,
          })),
        })),
    ),
  };
}
