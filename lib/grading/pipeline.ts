/**
 * Grading pipeline. Sheets are graded a few at a time per request so it works on serverless:
 * the progress screen keeps calling `gradeNext` until every matched sheet is graded.
 * Each answer: locate + crop, transcribe, grade against key and step rubric (two independent passes),
 * classify the mistake and misconception, tag concepts, and score confidence with reasons.
 */
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { ai, AiError } from "../ai";
import { audit } from "../audit";
import { config } from "../config";
import type { ConfidenceBand, RubricStep } from "../domain";
import { GENERIC_MISCONCEPTION, MISCONCEPTIONS } from "../fixtures/concepts";
import { storage, type StoredFile } from "../storage";
import { bandFor } from "./confidence";
import { answerGradeRow, sheetBand, signalsFor } from "./rows";
import type { QuestionForGrading } from "../ai/types";

export { sheetBand, signalsFor };

const STALE_MS = 3 * 60 * 1000;

export interface GradingProgressData {
  assessmentId: string;
  status: string;
  totalSheets: number;
  gradedSheets: number;
  errorSheets: { id: string; studentName: string | null; error: string }[];
  totalAnswers: number;
  answersGraded: number;
  bands: Record<ConfidenceBand, number>;
  sheetBands: Record<ConfidenceBand, number>;
  recent: { submissionId: string; studentName: string; band: ConfidenceBand; marks: number; maxMarks: number }[];
  done: boolean;
}

export async function getGradingProgress(assessmentId: string): Promise<GradingProgressData> {
  const a = await prisma.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      questions: true,
      submissions: { include: { student: true, answerGrades: { select: { confidence: true, awardedMarks: true, maxMarks: true } } } },
    },
  });
  const sheets = a.submissions.filter((s) => s.status !== "absent");
  const graded = sheets.filter((s) => s.status === "graded");
  const bands: Record<ConfidenceBand, number> = { high: 0, medium: 0, low: 0 };
  const sheetBands: Record<ConfidenceBand, number> = { high: 0, medium: 0, low: 0 };
  for (const s of graded) {
    for (const g of s.answerGrades) bands[bandFor(g.confidence)]++;
    sheetBands[sheetBand(s.answerGrades.map((g) => g.confidence))]++;
  }
  const recent = [...graded]
    .sort((x, y) => (y.gradedAt?.getTime() ?? 0) - (x.gradedAt?.getTime() ?? 0))
    .slice(0, 8)
    .map((s) => ({
      submissionId: s.id,
      studentName: s.student?.name ?? "Unmatched sheet",
      band: sheetBand(s.answerGrades.map((g) => g.confidence)),
      marks: s.answerGrades.reduce((t, g) => t + g.awardedMarks, 0),
      maxMarks: s.answerGrades.reduce((t, g) => t + g.maxMarks, 0),
    }));
  const pending = sheets.filter((s) => s.status === "matched" || s.status === "grading" || s.status === "uploaded").length;
  return {
    assessmentId,
    status: a.status,
    totalSheets: sheets.length,
    gradedSheets: graded.length,
    errorSheets: sheets.filter((s) => s.status === "error").map((s) => ({ id: s.id, studentName: s.student?.name ?? null, error: s.gradingError ?? "Unknown error" })),
    totalAnswers: sheets.length * a.questions.length,
    answersGraded: graded.reduce((t, s) => t + s.answerGrades.length, 0),
    bands,
    sheetBands,
    recent,
    done: pending === 0 && sheets.length > 0,
  };
}

async function questionsFor(assessmentId: string): Promise<QuestionForGrading[]> {
  const qs = await prisma.question.findMany({ where: { assessmentId }, orderBy: { number: "asc" } });
  return qs.map((q) => {
    const conceptIds = parseJson<string[]>(q.conceptIds, []);
    const labels = new Set<string>();
    for (const c of conceptIds) for (const m of MISCONCEPTIONS[c] ?? []) labels.add(m.label);
    labels.add(GENERIC_MISCONCEPTION.calculation);
    labels.add(GENERIC_MISCONCEPTION.incomplete);
    return {
      id: q.id,
      number: q.number,
      text: q.text,
      maxMarks: q.maxMarks,
      rubric: parseJson<RubricStep[]>(q.rubric, []),
      answerKey: q.answerKey,
      conceptIds,
      misconceptions: [...labels],
    };
  });
}

async function gradeOne(submissionId: string, questions: QuestionForGrading[], concepts: { id: string; name: string; chapter: string }[]) {
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  const pageKeys = parseJson<string[]>(sub.pageKeys, []);
  const pages = (await Promise.all(pageKeys.map((k) => storage().get(k)))).filter((p): p is StoredFile => p !== null);
  const started = Date.now();
  const result = await ai().gradeSheet({ sheetRef: sub.sheetRef, pageKeys, pages, questions, concepts });

  const rows = result.answers.map((ans) => answerGradeRow(submissionId, questions.find((x) => x.number === ans.questionNumber)!, ans));

  await prisma.$transaction([
    prisma.answerGrade.deleteMany({ where: { submissionId } }),
    prisma.answerGrade.createMany({ data: rows }),
    prisma.submission.update({
      where: { id: submissionId },
      data: { status: "graded", gradedAt: new Date(), gradingError: null, latencyMs: Date.now() - started, costUsd: result.meta.costUsd },
    }),
  ]);
  await audit("ai", "sheet.graded", "Submission", submissionId, {
    mode: result.meta.mode,
    model: result.meta.model,
    calls: result.meta.calls,
    latencyMs: Date.now() - started,
    costUsd: result.meta.costUsd,
    inputTokens: result.meta.inputTokens,
    outputTokens: result.meta.outputTokens,
    answers: rows.length,
    bands: rows.map((r) => bandFor(r.confidence)),
    injection: rows.filter((r) => JSON.parse(r.signals).injectionDetected).map((r) => r.questionId),
  });
}

/** Grades up to `batch` sheets that are waiting, then returns overall progress. */
export async function gradeNext(assessmentId: string, batch = config.grading.sheetsPerBatch): Promise<GradingProgressData> {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { section: true } });
  if (a.status === "final") throw new Error("This assessment is already final.");
  if (!["sheets_uploaded", "grading", "in_review"].includes(a.status)) throw new Error("Confirm the questions and sheet matches before grading.");
  if (a.status !== "grading") {
    await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "grading" } });
    if (a.status === "sheets_uploaded") await audit("teacher", "grading.started", "Assessment", assessmentId);
  }

  const questions = await questionsFor(assessmentId);
  const concepts = (await prisma.concept.findMany({ where: { gradeLevel: a.section.grade, parentId: null } })).map((c) => ({ id: c.id, name: c.name, chapter: c.chapter }));
  const candidates = await prisma.submission.findMany({
    where: {
      assessmentId,
      OR: [{ status: "matched" }, { status: "grading", gradingStartedAt: { lt: new Date(Date.now() - STALE_MS) } }],
    },
    orderBy: { createdAt: "asc" },
    take: batch * 3,
  });

  let done = 0;
  for (const c of candidates) {
    if (done >= batch) break;
    // Atomic claim so two progress screens never grade the same sheet.
    const claimed = await prisma.submission.updateMany({
      where: { id: c.id, status: c.status, gradingStartedAt: c.gradingStartedAt },
      data: { status: "grading", gradingStartedAt: new Date() },
    });
    if (claimed.count !== 1) continue;
    try {
      await gradeOne(c.id, questions, concepts);
    } catch (err) {
      const message = err instanceof AiError ? err.message : err instanceof Error ? err.message : String(err);
      await prisma.submission.update({ where: { id: c.id }, data: { status: "error", gradingError: message } });
      await audit("ai", "sheet.grading_failed", "Submission", c.id, { error: message });
    }
    done++;
  }

  const progress = await getGradingProgress(assessmentId);
  if (progress.done && progress.status === "grading") {
    await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "in_review" } });
    await audit("ai", "assessment.graded", "Assessment", assessmentId, { answers: progress.answersGraded, bands: progress.bands, sheetBands: progress.sheetBands });
    return { ...progress, status: "in_review" };
  }
  return progress;
}

export async function retrySheet(submissionId: string) {
  await prisma.submission.update({ where: { id: submissionId }, data: { status: "matched", gradingError: null } });
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  await prisma.assessment.update({ where: { id: sub.assessmentId }, data: { status: "grading" } });
}
