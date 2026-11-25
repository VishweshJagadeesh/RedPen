/** Assessment creation, paper parsing, sheet upload and student matching. */
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { ai } from "../ai";
import { audit } from "../audit";
import { storage, contentTypeFor, type StoredFile } from "../storage";
import { proposeMatch } from "../grading/matching";
import { sheetsInSet, SAMPLE_PAPERS, type MockSheet } from "../fixtures/sheets";
import { syntheticAbsent, syntheticPageKeys, syntheticSheetRef } from "../fixtures/synthetic";
import { aiMode } from "../ai/mode";
import { PAPER_BY_KEY } from "../fixtures/papers";
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

/** The bundled handwriting sample set for a seeded story, if this assessment is one. */
export function sampleSetFor(fixtureKey: string | null | undefined): MockSheet["set"] | null {
  if (fixtureKey === "c8-wt4") return "8b-wt4";
  if (fixtureKey === "c8-et-transposing") return "8b-exit-ticket";
  if (fixtureKey === "remedial-transposing") return "8b-remedial-rohan";
  return null;
}

/**
 * Which sample sheets "Use the sample answer sheets" can attach:
 * - "fixture": the bundled handwriting photos of a seeded story (works in mock and live mode);
 * - "synthetic": generated practice sheets for every student (mock mode only — the mock AI grades them);
 * - null: none (live mode, not a seeded story).
 */
export function sampleKindFor(fixtureKey: string | null | undefined, mode = aiMode()): "fixture" | "synthetic" | null {
  if (sampleSetFor(fixtureKey)) return "fixture";
  return mode === "mock" ? "synthetic" : null;
}

/**
 * Sample papers: the bundled paper + key photos, or (mock mode only) any fixture paper by its key — the mock
 * AI reads its questions from the fixtures, so no photo is needed.
 */
export function samplePaperFor(fixtureKey: string, mode = aiMode()) {
  if (SAMPLE_PAPERS[fixtureKey]) return SAMPLE_PAPERS[fixtureKey];
  if (mode === "mock" && PAPER_BY_KEY[fixtureKey]) return { paper: [] as string[], key: [] as string[] };
  return null;
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
/** Uploading sheets means the work went out to the class. */
async function markHandedOut(assessmentId: string) {
  await prisma.assessment.updateMany({ where: { id: assessmentId, handedOut: false }, data: { handedOut: true, handedOutAt: new Date() } });
}

export async function addPage(assessmentId: string, pageKey: string) {
  await markHandedOut(assessmentId);
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

/** Average share of marks each student earned on graded work so far (drives synthetic answers). */
async function abilities(studentIds: string[]) {
  const rows = await prisma.answerGrade.findMany({
    where: { submission: { studentId: { in: studentIds }, assessment: { status: "final" } } },
    select: { awardedMarks: true, teacherMarks: true, maxMarks: true, submission: { select: { studentId: true } } },
  });
  const sums = new Map<string, { got: number; max: number }>();
  for (const r of rows) {
    const id = r.submission.studentId!;
    const s = sums.get(id) ?? { got: 0, max: 0 };
    s.got += r.teacherMarks ?? r.awardedMarks;
    s.max += r.maxMarks;
    sums.set(id, s);
  }
  return (id: string) => {
    const s = sums.get(id);
    return s && s.max > 0 ? s.got / s.max : 0.65;
  };
}

/**
 * Demo helper behind "Use the sample answer sheets". Seeded stories get their bundled handwriting
 * photos; every other assessment gets generated practice sheets in mock mode (see lib/fixtures/synthetic.ts).
 */
export async function attachSampleSheets(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { _count: { select: { questions: true } } } });
  const kind = sampleKindFor(a.fixtureKey);
  if (!kind) throw new Error("Sample answer sheets are only available for the seeded demo tests in live mode. Upload photos of the real sheets instead.");
  if (a._count.questions === 0) throw new Error("Confirm the questions first.");
  const students = await roster(assessmentId);
  const set = sampleSetFor(a.fixtureKey);
  let fixtureSheets = set ? sheetsInSet(set) : [];
  if (set === "8b-remedial-rohan") fixtureSheets = fixtureSheets.filter((s) => students.some((st) => st.id === s.studentId));
  // Remedial groups can include students without a bundled sheet; they get a generated one (mock mode).
  const covered = new Set(fixtureSheets.map((s) => s.studentId));
  const needSynthetic = !set || set === "8b-remedial-rohan" ? students.filter((s) => !covered.has(s.id)) : [];
  const synthetic = aiMode() === "mock" ? needSynthetic.filter((s) => !syntheticAbsent(assessmentId, s.id, students.length)) : [];
  if (fixtureSheets.length + synthetic.length === 0) throw new Error("There are no sample sheets for these students in live mode. Upload photos of the real sheets instead.");

  await prisma.submission.deleteMany({ where: { assessmentId, answerGrades: { none: {} } } });
  await markHandedOut(assessmentId);
  const prefix = assessmentId.replace("asm_", "");
  let i = 0;
  // One batched insert instead of one round trip per sheet (matters on a remote database).
  const rows: Prisma.SubmissionCreateManyInput[] = [];
  for (const s of fixtureSheets) {
    const match = proposeMatch(s.detected, students);
    rows.push({
        id: `sub_${prefix}_${String(i++).padStart(3, "0")}`,
        assessmentId,
        studentId: match.studentId,
        status: match.studentId ? "matched" : "uploaded",
        pageKeys: JSON.stringify(s.pageKeys),
        sheetRef: s.sheetRef,
        detectedName: s.detected.name,
        detectedRoll: s.detected.roll,
        matchConfidence: match.confidence,
        createdAt: new Date(Date.now() + i),
    });
  }
  const ability = synthetic.length ? await abilities(synthetic.map((s) => s.id)) : () => 0.65;
  for (const st of synthetic) {
    const id = `sub_${prefix}_${String(i++).padStart(3, "0")}`;
    const match = proposeMatch({ name: st.name, roll: st.rollNumber }, students);
    rows.push({
        id,
        assessmentId,
        studentId: match.studentId,
        status: match.studentId ? "matched" : "uploaded",
        pageKeys: JSON.stringify(syntheticPageKeys(id, a._count.questions)),
        sheetRef: syntheticSheetRef({ assessmentId, studentId: st.id, ability: ability(st.id) }),
        detectedName: st.name,
        detectedRoll: st.rollNumber,
        matchConfidence: match.confidence,
        createdAt: new Date(Date.now() + i),
    });
  }
  await prisma.submission.createMany({ data: rows });
  await audit("teacher", "sheets.sample_attached", "Assessment", assessmentId, { set: set ?? "synthetic", fixture: fixtureSheets.length, synthetic: synthetic.length });
  return fixtureSheets.length + synthetic.length;
}

/** "Save draft & leave" on an unfinished assessment set-up (optionally with edited questions). */
export async function saveAssessmentDraft(assessmentId: string, questions?: QuestionDraft[]) {
  if (questions) await saveQuestions(assessmentId, questions, false);
  await prisma.assessment.update({ where: { id: assessmentId }, data: { draftSavedAt: new Date() } });
  await audit("teacher", "assessment.draft_saved", "Assessment", assessmentId, {});
}

/** "Discard": deletes an assessment that has nothing graded yet. */
export async function discardAssessment(assessmentId: string) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!a) return;
  const graded = await prisma.answerGrade.count({ where: { submission: { assessmentId } } });
  if (graded > 0) throw new Error("Answers have already been graded, so this assessment cannot be discarded.");
  if (a.remedialAssignmentId) throw new Error("This belongs to an assigned remedial sheet and cannot be discarded here.");
  await prisma.$transaction(async (tx) => {
    if (a.lessonPlanId) await tx.lessonPlan.updateMany({ where: { id: a.lessonPlanId, exitTicketAssessmentId: assessmentId }, data: { exitTicketAssessmentId: null } });
    await tx.assessment.delete({ where: { id: assessmentId } });
  });
  await audit("teacher", "assessment.discarded", "Assessment", assessmentId, { title: a.title });
}

/** "Yet to hand it to the class": keep it set up (printable, shareable) and listed as ready to grade. */
export async function setHandedOut(assessmentId: string, handedOut: boolean) {
  await prisma.assessment.update({ where: { id: assessmentId }, data: { handedOut, handedOutAt: handedOut ? new Date() : null } });
  await audit("teacher", handedOut ? "assessment.handed_out" : "assessment.not_handed_out", "Assessment", assessmentId, {});
}

/** A read-only student copy link (/w/[token]) the teacher can share with the class. */
export async function shareToken(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { _count: { select: { questions: true } } } });
  if (a._count.questions === 0) throw new Error("Confirm the questions first.");
  if (a.shareToken) return a.shareToken;
  const token = crypto.randomBytes(12).toString("base64url");
  await prisma.assessment.update({ where: { id: assessmentId }, data: { shareToken: token } });
  await audit("teacher", "assessment.shared", "Assessment", assessmentId, {});
  return token;
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
  await prisma.submission.createMany({
    data: absent.map((s) => ({ id: `sub_${assessmentId.replace("asm_", "")}_abs_${s.id.replace("stu_", "")}`, assessmentId, studentId: s.id, status: "absent" })),
  });
  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "sheets_uploaded" } });
  await audit("teacher", "sheets.matches_confirmed", "Assessment", assessmentId, { sheets: subs.length });
}
