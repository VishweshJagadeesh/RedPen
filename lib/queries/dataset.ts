/** Loads a section's finalised work from the database into the pure diagnosis dataset shape. */
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import type { AssessmentType, MistakeType } from "../domain";
import type { SectionDataset } from "../diagnosis/dataset";
import { isoDate } from "../format";

export function effectiveMarks(g: { status: string; awardedMarks: number; teacherMarks: number | null }): number {
  return g.status === "overridden" && g.teacherMarks !== null ? g.teacherMarks : g.awardedMarks;
}

export function shortTitleOf(title: string, type: string): string {
  const m = title.match(/^(Weekly Test|Periodic Test|Term Exam)\s+(\d+)/i);
  if (m) return `${m[1].split(" ").map((w) => w[0].toUpperCase()).join("")}${m[2]}`;
  if (type === "exit_ticket") return "Exit ticket";
  if (type === "remedial") return "Remedial";
  return title.length > 14 ? `${title.slice(0, 13)}…` : title;
}

export async function loadSectionDataset(sectionId: string, opts: { includeAssessmentIds?: string[] } = {}): Promise<SectionDataset> {
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
  const [students, concepts, assessments, remedials] = await Promise.all([
    prisma.student.findMany({ where: { sectionId }, orderBy: { rollNumber: "asc" } }),
    prisma.concept.findMany({ where: { gradeLevel: section.grade, parentId: null }, orderBy: { order: "asc" } }),
    prisma.assessment.findMany({
      where: { sectionId, OR: [{ status: "final" }, ...(opts.includeAssessmentIds?.length ? [{ id: { in: opts.includeAssessmentIds } }] : [])] },
      orderBy: { date: "asc" },
      include: {
        questions: { orderBy: { number: "asc" } },
        submissions: { include: { answerGrades: true } },
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
