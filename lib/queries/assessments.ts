import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { aiMode } from "../ai/mode";
import { fileUrl } from "../storage";
import { proposeMatch, MATCH_REVIEW_THRESHOLD } from "../grading/matching";
import { sampleSetFor } from "../services/assessments";
import type { RubricStep } from "../domain";

export async function listAssessments(teacherId: string) {
  const rows = await prisma.assessment.findMany({
    where: { section: { teacherId } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { section: true, _count: { select: { submissions: true, questions: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    date: a.date.toISOString(),
    status: a.status,
    section: a.section.name,
    sectionId: a.sectionId,
    sheets: a._count.submissions,
    questions: a._count.questions,
  }));
}
export type AssessmentListItem = Awaited<ReturnType<typeof listAssessments>>[number];

export async function getAssessmentWizard(id: string) {
  const a = await prisma.assessment.findUnique({
    where: { id },
    include: {
      section: true,
      questions: { orderBy: { number: "asc" } },
      submissions: { orderBy: { createdAt: "asc" }, include: { _count: { select: { answerGrades: true } } } },
    },
  });
  if (!a) return null;
  let students = await prisma.student.findMany({ where: { sectionId: a.sectionId }, orderBy: { rollNumber: "asc" } });
  if (a.remedialAssignmentId) {
    const r = await prisma.remedialAssignment.findUnique({ where: { id: a.remedialAssignmentId } });
    const ids = parseJson<string[]>(r?.studentIds, []);
    if (ids.length) students = students.filter((s) => ids.includes(s.id));
  }
  const concepts = await prisma.concept.findMany({ where: { gradeLevel: a.section.grade, parentId: null }, orderBy: { order: "asc" } });
  const roster = students.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber }));
  const sheets = a.submissions
    .filter((s) => s.status !== "absent")
    .map((s) => {
      const pageKeys = parseJson<string[]>(s.pageKeys, []);
      const proposal = proposeMatch({ name: s.detectedName, roll: s.detectedRoll }, roster);
      const confidence = s.matchConfidence ?? 0;
      return {
        id: s.id,
        pageCount: pageKeys.length,
        firstPageUrl: pageKeys[0] ? fileUrl(pageKeys[0]) : null,
        detectedName: s.detectedName,
        detectedRoll: s.detectedRoll,
        studentId: s.studentId,
        confidence,
        reason: confidence >= 1 ? "Confirmed by you" : proposal.reason,
        needsReview: !s.studentId || confidence < MATCH_REVIEW_THRESHOLD,
        graded: s._count.answerGrades > 0,
      };
    });
  const matchedIds = new Set(sheets.map((s) => s.studentId).filter(Boolean));
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    date: a.date.toISOString(),
    status: a.status,
    section: { id: a.section.id, name: a.section.name },
    paperUrls: parseJson<string[]>(a.questionPaperKeys, []).map(fileUrl),
    keyUrls: parseJson<string[]>(a.answerKeyKeys, []).map(fileUrl),
    warnings: a.parseError ? a.parseError.split("\n") : [],
    questions: a.questions.map((q) => ({
      number: q.number,
      text: q.text,
      maxMarks: q.maxMarks,
      rubric: parseJson<RubricStep[]>(q.rubric, []),
      answerKey: q.answerKey,
      conceptIds: parseJson<string[]>(q.conceptIds, []),
    })),
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, chapter: c.chapter })),
    roster,
    sheets,
    missingStudents: roster.filter((s) => !matchedIds.has(s.id)),
    sampleSet: sampleSetFor(a.fixtureKey, a.type),
    mode: aiMode(),
  };
}
export type AssessmentWizardData = NonNullable<Awaited<ReturnType<typeof getAssessmentWizard>>>;
