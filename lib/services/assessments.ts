/** Assessment creation, paper parsing, sheet upload and student matching. */
import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { ai } from "../ai";
import { audit } from "../audit";
import { storage, contentTypeFor, type StoredFile } from "../storage";
import { proposeMatch } from "../grading/matching";
import { sheetsInSet, SAMPLE_PAPERS, type MockSheet } from "../fixtures/sheets";
import type { AssessmentType, RubricStep } from "../domain";

export interface QuestionDraft {
  number: number;
  text: string;
  maxMarks: number;
  rubric: RubricStep[];
  answerKey: string;
  conceptIds: string[];
}

export async function storeUpload(prefix: string, file: File): Promise<string> {
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? (file.type === "application/pdf" ? ".pdf" : ".jpg")).toLowerCase();
  const key = `uploads/${prefix}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const data = Buffer.from(await file.arrayBuffer());
  return storage().put(key, data, file.type || contentTypeFor(key));
}

async function load(keys: string[]): Promise<StoredFile[]> {
  const files = await Promise.all(keys.map((k) => storage().get(k)));
  return files.filter((f): f is StoredFile => f !== null);
}

export async function createAssessment(input: {
  sectionId: string;
  title: string;
  type: AssessmentType;
  date: string;
  paperKeys: string[];
  keyKeys: string[];
  fixtureKey?: string | null;
}) {
  const id = `asm_${crypto.randomBytes(6).toString("hex")}`;
  const a = await prisma.assessment.create({
    data: {
      id,
      sectionId: input.sectionId,
      title: input.title,
      type: input.type,
      date: new Date(`${input.date}T00:00:00Z`),
      questionPaperKeys: JSON.stringify(input.paperKeys),
      answerKeyKeys: JSON.stringify(input.keyKeys),
      fixtureKey: input.fixtureKey ?? null,
      status: "draft",
    },
  });
  await audit("teacher", "assessment.created", "Assessment", a.id, { title: a.title, type: a.type });
  return a;
}

export function sampleSetFor(fixtureKey: string | null | undefined, type: string): MockSheet["set"] | null {
  if (fixtureKey === "c8-wt4") return "8b-wt4";
  if (fixtureKey === "c8-et-transposing") return "8b-exit-ticket";
  if (fixtureKey === "remedial-transposing" || type === "remedial") return "8b-remedial-rohan";
  return null;
}

export function samplePaperFor(fixtureKey: string) {
  return SAMPLE_PAPERS[fixtureKey] ?? null;
}

/** Step 2: the AI splits the paper into questions; the teacher confirms in a table. */
export async function parseAssessmentPaper(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { section: true } });
  const paperKeys = parseJson<string[]>(a.questionPaperKeys, []);
  const keyKeys = parseJson<string[]>(a.answerKeyKeys, []);
  const concepts = await prisma.concept.findMany({ where: { gradeLevel: a.section.grade, parentId: null }, orderBy: { order: "asc" } });
  const result = await ai().parsePaper({
    paperKeys,
    keyKeys,
    paperFiles: await load(paperKeys),
    keyFiles: await load(keyKeys),
    fixtureKey: a.fixtureKey,
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, chapter: c.chapter })),
  });
  await saveQuestions(assessmentId, result.paper.questions, false);
  await prisma.assessment.update({ where: { id: assessmentId }, data: { parseError: result.paper.warnings.join("\n") || null } });
  await audit("ai", "paper.parsed", "Assessment", assessmentId, { questions: result.paper.questions.length, warnings: result.paper.warnings, ...result.meta });
  return result.paper;
}

export async function saveQuestions(assessmentId: string, questions: QuestionDraft[], confirm: boolean) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.question.findMany({ where: { assessmentId } });
    const graded = await tx.answerGrade.count({ where: { questionId: { in: existing.map((q) => q.id) } } });
    if (graded > 0) throw new Error("Questions cannot be changed after grading has started.");
    await tx.question.deleteMany({ where: { assessmentId } });
    await tx.question.createMany({
      data: questions.map((q) => ({
        id: `q_${assessmentId}_${q.number}`,
        assessmentId,
        number: q.number,
        text: q.text,
        maxMarks: q.rubric.reduce((s, r) => s + r.marks, 0) || q.maxMarks,
        rubric: JSON.stringify(q.rubric),
        conceptIds: JSON.stringify(q.conceptIds),
        answerKey: q.answerKey,
      })),
    });
    if (confirm) await tx.assessment.update({ where: { id: assessmentId }, data: { status: "questions_ready" } });
  });
  if (confirm) await audit("teacher", "questions.confirmed", "Assessment", assessmentId, { count: questions.length });
}

async function roster(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  let students = await prisma.student.findMany({ where: { sectionId: a.sectionId }, orderBy: { rollNumber: "asc" } });
  if (a.remedialAssignmentId) {
    const r = await prisma.remedialAssignment.findUnique({ where: { id: a.remedialAssignmentId } });
    const ids = parseJson<string[]>(r?.studentIds, []);
    if (ids.length) students = students.filter((s) => ids.includes(s.id));
  }
  return students;
}

/**
 * Step 3: pages are uploaded in order. A page with a name/roll header starts a new sheet; other
 * pages are appended to the previous sheet. The proposed student match is stored for review.
 */
export async function addPage(assessmentId: string, pageKey: string) {
  const page = await storage().get(pageKey);
  if (!page) throw new Error("Upload could not be read back from storage.");
  const header = await ai().readSheetHeader({ pageKey, page });
  const last = await prisma.submission.findFirst({ where: { assessmentId }, orderBy: { createdAt: "desc" } });
  if (!header.isFirstPage && last) {
    const keys = parseJson<string[]>(last.pageKeys, []);
    await prisma.submission.update({ where: { id: last.id }, data: { pageKeys: JSON.stringify([...keys, pageKey]) } });
    return { submissionId: last.id, newSheet: false };
  }
  const students = await roster(assessmentId);
  const match = proposeMatch({ name: header.name, roll: header.roll }, students);
  const sub = await prisma.submission.create({
    data: {
      id: `sub_${crypto.randomBytes(6).toString("hex")}`,
      assessmentId,
      studentId: match.studentId,
      status: match.studentId ? "matched" : "uploaded",
      pageKeys: JSON.stringify([pageKey]),
      detectedName: header.name,
      detectedRoll: header.roll,
      matchConfidence: match.confidence,
    },
  });
  return { submissionId: sub.id, newSheet: true };
}

/** Demo helper: attach the bundled sample sheets for this assessment (works in mock and live mode). */
export async function attachSampleSheets(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  const set = sampleSetFor(a.fixtureKey, a.type);
  if (!set) throw new Error("There are no sample sheets for this assessment.");
  const students = await roster(assessmentId);
  let sheets = sheetsInSet(set);
  if (set === "8b-remedial-rohan") sheets = sheets.filter((s) => students.some((st) => st.id === s.studentId));
  await prisma.submission.deleteMany({ where: { assessmentId, answerGrades: { none: {} } } });
  let i = 0;
  for (const s of sheets) {
    const match = proposeMatch(s.detected, students);
    await prisma.submission.create({
      data: {
        id: `sub_${assessmentId.replace("asm_", "")}_${String(i++).padStart(3, "0")}`,
        assessmentId,
        studentId: match.studentId,
        status: match.studentId ? "matched" : "uploaded",
        pageKeys: JSON.stringify(s.pageKeys),
        sheetRef: s.sheetRef,
        detectedName: s.detected.name,
        detectedRoll: s.detected.roll,
        matchConfidence: match.confidence,
        createdAt: new Date(Date.now() + i),
      },
    });
  }
  await audit("teacher", "sheets.sample_attached", "Assessment", assessmentId, { set, count: sheets.length });
  return sheets.length;
}

export async function setSubmissionStudent(submissionId: string, studentId: string | null) {
  const sub = await prisma.submission.update({
    where: { id: submissionId },
    data: { studentId, status: studentId ? "matched" : "uploaded", matchConfidence: studentId ? 1 : 0 },
  });
  await audit("teacher", "sheet.matched", "Submission", submissionId, { studentId });
  return sub;
}

export async function confirmMatches(assessmentId: string) {
  const subs = await prisma.submission.findMany({ where: { assessmentId, status: { not: "absent" } } });
  if (subs.length === 0) throw new Error("Upload at least one answer sheet first.");
  const unmatched = subs.filter((s) => !s.studentId);
  if (unmatched.length) throw new Error(`${unmatched.length} sheet${unmatched.length === 1 ? " is" : "s are"} not matched to a student yet.`);
  const ids = subs.map((s) => s.studentId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error("Two sheets are matched to the same student. Fix the duplicate first.");
  await prisma.submission.updateMany({ where: { assessmentId, status: "matched" }, data: { matchConfidence: 1 } });
  // Students without a sheet are recorded as absent, so missed submissions are tracked.
  const students = await roster(assessmentId);
  const all = await prisma.submission.findMany({ where: { assessmentId }, select: { studentId: true } });
  const present = new Set(all.map((x) => x.studentId));
  const absent = students.filter((s) => !present.has(s.id));
  for (const s of absent) {
    await prisma.submission.create({ data: { id: `sub_${assessmentId.replace("asm_", "")}_abs_${s.id.replace("stu_", "")}`, assessmentId, studentId: s.id, status: "absent" } });
  }
  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "sheets_uploaded" } });
  await audit("teacher", "sheets.matches_confirmed", "Assessment", assessmentId, { sheets: subs.length });
}
