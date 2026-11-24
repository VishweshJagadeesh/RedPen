/** Teacher review of AI-suggested grades, and finalisation. No grade is final until accepted. */
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { audit } from "../audit";
import { config } from "../config";
import type { StepAward } from "../domain";
import { onAssessmentFinalised } from "./followups";

export async function acceptGrade(id: string) {
  const g = await prisma.answerGrade.findUniqueOrThrow({ where: { id } });
  if (g.needsRescan) throw new Error("This answer is waiting for a re-scan.");
  await prisma.answerGrade.update({ where: { id }, data: { status: "accepted", reviewedAt: new Date(), teacherMarks: null, teacherSteps: null } });
  await audit("teacher", "grade.accept", "AnswerGrade", id, { marks: g.awardedMarks, confidence: g.confidence });
}

export async function overrideGrade(id: string, awards: number[], note: string | null, opts: { mistakeType?: string; misconception?: string | null } = {}) {
  const g = await prisma.answerGrade.findUniqueOrThrow({ where: { id } });
  const steps = parseJson<StepAward[]>(g.steps, []);
  if (awards.length !== steps.length) throw new Error("Give a mark for every rubric step.");
  const teacherSteps = steps.map((s, i) => {
    const a = Number(awards[i]);
    if (!Number.isFinite(a) || a < 0 || a > s.marks) throw new Error(`Step ${i + 1} must be between 0 and ${s.marks}.`);
    return { ...s, awarded: Math.round(a * 2) / 2 };
  });
  const teacherMarks = teacherSteps.reduce((t, s) => t + s.awarded, 0);
  const same = teacherSteps.every((s, i) => s.awarded === steps[i].awarded) && !opts.mistakeType;
  await prisma.answerGrade.update({
    where: { id },
    data: {
      status: same ? "accepted" : "overridden",
      teacherMarks: same ? null : teacherMarks,
      teacherSteps: same ? null : JSON.stringify(teacherSteps),
      teacherNote: note || null,
      needsRescan: false,
      reviewedAt: new Date(),
      ...(opts.mistakeType ? { mistakeType: opts.mistakeType } : {}),
      ...(opts.misconception !== undefined ? { misconception: opts.misconception } : {}),
    },
  });
  await audit("teacher", same ? "grade.accept" : "grade.override", "AnswerGrade", id, {
    from: g.awardedMarks,
    to: teacherMarks,
    fromSteps: steps.map((s) => s.awarded),
    toSteps: teacherSteps.map((s) => s.awarded),
    confidence: g.confidence,
    note,
  });
}

export async function markIllegible(id: string, note: string | null) {
  const g = await prisma.answerGrade.findUniqueOrThrow({ where: { id } });
  const steps = parseJson<StepAward[]>(g.steps, []);
  await overrideGrade(id, steps.map(() => 0), note || "Illegible — marked 0 by the teacher.", { mistakeType: "illegible", misconception: null });
}

export async function markNeedsRescan(id: string, note: string | null) {
  await prisma.answerGrade.update({ where: { id }, data: { needsRescan: true, status: "pending_review", teacherNote: note || "Needs a re-scan" } });
  await audit("teacher", "grade.needs_rescan", "AnswerGrade", id, { note });
}

export async function acceptAllHigh(assessmentId: string) {
  const pending = await prisma.answerGrade.findMany({
    where: { submission: { assessmentId }, status: "pending_review", needsRescan: false, confidence: { gte: config.confidence.high } },
    select: { id: true },
  });
  await prisma.answerGrade.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "accepted", reviewedAt: new Date() } });
  await audit("teacher", "grade.accept_all_high", "Assessment", assessmentId, { count: pending.length, threshold: config.confidence.high });
  return pending.length;
}

export async function reviewStatus(assessmentId: string) {
  const grades = await prisma.answerGrade.findMany({ where: { submission: { assessmentId } }, select: { status: true, needsRescan: true } });
  const pendingSheets = await prisma.submission.count({ where: { assessmentId, status: { in: ["matched", "grading", "error", "uploaded"] } } });
  return {
    total: grades.length,
    reviewed: grades.filter((g) => g.status !== "pending_review").length,
    rescans: grades.filter((g) => g.needsRescan).length,
    pendingSheets,
  };
}

export async function finaliseAssessment(assessmentId: string) {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  if (a.status === "final") return { alreadyFinal: true, followups: [] as string[] };
  const s = await reviewStatus(assessmentId);
  if (s.pendingSheets > 0) throw new Error(`${s.pendingSheets} sheet(s) are not graded yet.`);
  if (s.total === 0) throw new Error("Nothing has been graded yet.");
  if (s.reviewed < s.total) throw new Error(`${s.total - s.reviewed} answer(s) still need your review.`);
  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "final", finalizedAt: new Date() } });
  await audit("teacher", "assessment.finalised", "Assessment", assessmentId, { answers: s.total });
  const followups = await onAssessmentFinalised(assessmentId);
  return { alreadyFinal: false, followups };
}
