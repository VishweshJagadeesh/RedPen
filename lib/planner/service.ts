/** Reteach plans: evidence snapshot, generation, editing, teaching, and the exit-ticket loop. */
import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { aiMode } from "../ai/mode";
import { audit } from "../audit";
import { config } from "../config";
import { DatasetIndex } from "../diagnosis/dataset";
import { classConceptSummary, suggestPeerPairs } from "../diagnosis/mastery";
import { C8_EXIT_TICKET_TRANSPOSING } from "../fixtures/papers";
import type { RubricStep } from "../domain";
import { loadSectionDataset } from "../queries/dataset";
import { livePlanSections, liveRegenerateSection } from "./live";
import { mockPlanSections, mockRegenerateSection } from "./mock";
import { TIMED_KINDS, type PlanEvidence, type PlanInputs, type PlanProgress, type PlanSection } from "./types";

const newId = () => crypto.randomBytes(5).toString("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function buildEvidence(sectionId: string, conceptId: string): Promise<{ evidence: PlanEvidence; students: { id: string; name: string }[]; summary: NonNullable<ReturnType<typeof classConceptSummary>> }> {
  const ds = await loadSectionDataset(sectionId);
  const idx = new DatasetIndex(ds);
  const s = classConceptSummary(idx, conceptId);
  if (!s) throw new Error("There is no graded evidence for this concept yet.");
  const pairs = suggestPeerPairs(s, ds.students);
  const qs = await prisma.question.findMany({ where: { assessmentId: s.assessmentId }, orderBy: { number: "asc" } });
  const sourceQuestions = qs
    .filter((q) => parseJson<string[]>(q.conceptIds, []).includes(conceptId))
    .map((q) => ({ text: q.text, answer: q.answerKey, marks: q.maxMarks, rubric: parseJson<RubricStep[]>(q.rubric, []) }));
  return {
    summary: s,
    students: ds.students,
    evidence: {
      conceptId,
      conceptName: s.conceptName,
      chapter: s.chapter,
      assessmentId: s.assessmentId,
      assessmentTitle: s.assessmentTitle,
      studentsAssessed: s.studentsAssessed,
      studentsUnder: s.studentsUnder,
      meanPct: s.meanPct,
      misconceptions: s.misconceptions,
      snippets: s.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
      mentors: pairs.groups.length,
      learners: s.studentsUnder,
      sourceQuestions,
    },
  };
}

function withIds(sections: Omit<PlanSection, "id">[]): PlanSection[] {
  return sections.map((s) => ({ ...s, id: newId() }));
}

async function attachPairs(sectionId: string, conceptId: string, sections: PlanSection[], seed = 0) {
  const { summary, students } = await buildEvidence(sectionId, conceptId);
  const pairs = suggestPeerPairs(summary, students, config.diagnosis, seed);
  return sections.map((s) => (s.kind === "peer_pairs" ? { ...s, pairs: { ...pairs, seed } } : s));
}

/**
 * Generates a draft plan. `progress` reports each step as it happens (the setup page streams these to a
 * progress bar); in mock mode the steps are paced by MOCK_LATENCY_MS so the stepper is visible.
 */
export async function createPlan(sectionId: string, conceptId: string, inputs: PlanInputs, progress: PlanProgress = () => {}) {
  const live = aiMode() === "live";
  const pace = () => (live ? Promise.resolve() : sleep(config.grading.mockLatencyMs * 3));
  const started = Date.now();
  progress("evidence", "active");
  const { evidence } = await buildEvidence(sectionId, conceptId);
  await pace();
  progress("evidence", "done", `${evidence.studentsUnder} of ${evidence.studentsAssessed} students under 50% in ${evidence.assessmentTitle}`);
  progress("misconceptions", "active");
  await pace();
  const named = evidence.misconceptions.filter((m) => !/unattempted/i.test(m.label)).slice(0, 2);
  progress("misconceptions", "done", named.length ? named.map((m, i) => `#${i + 1} ${m.label} (${m.count})`).join(" · ") : "No named misconception; the plan rebuilds the method");
  progress("draft", "active", live ? "The AI is writing the plan from your class's mistakes. This usually takes 20–60 seconds." : undefined);
  let generated;
  if (live) {
    generated = await livePlanSections(evidence, inputs, progress);
  } else {
    generated = mockPlanSections(evidence, inputs);
    await pace();
    progress("draft", "done", `${generated.length} sections`);
    progress("checks", "active");
    await pace();
  }
  const timed = generated.filter((s) => TIMED_KINDS.includes(s.kind)).reduce((t, s) => t + s.minutes, 0);
  const exit = generated.find((s) => s.kind === "exit_ticket")?.questions.length ?? 0;
  progress("checks", "done", `${timed} of ${inputs.periodMinutes} minutes · ${exit}-question exit ticket`);
  progress("pairs", "active");
  const sections = await attachPairs(sectionId, conceptId, withIds(generated));
  await pace();
  const groups = sections.find((s) => s.kind === "peer_pairs")?.pairs?.groups.length ?? 0;
  progress("pairs", "done", groups ? `${groups} mentor groups` : "No mentors available");
  progress("save", "active");
  const id = `plan_${newId()}`;
  await prisma.lessonPlan.create({
    data: { id, sectionId, conceptId, evidence: JSON.stringify(evidence), inputs: JSON.stringify(inputs), sections: JSON.stringify(sections), status: "draft" },
  });
  await audit("ai", "plan.generated", "LessonPlan", id, { mode: aiMode(), conceptId, latencyMs: Date.now() - started, sections: sections.length });
  progress("save", "done");
  return id;
}

export async function getPlan(planId: string) {
  const p = await prisma.lessonPlan.findUnique({ where: { id: planId }, include: { section: true } });
  if (!p) return null;
  const exit = p.exitTicketAssessmentId ? await prisma.assessment.findUnique({ where: { id: p.exitTicketAssessmentId } }) : null;
  const students = await prisma.student.findMany({ where: { sectionId: p.sectionId }, orderBy: { rollNumber: "asc" } });
  return {
    id: p.id,
    status: p.status as "draft" | "ready" | "taught",
    taughtAt: p.taughtAt?.toISOString() ?? null,
    section: { id: p.section.id, name: p.section.name },
    conceptId: p.conceptId,
    evidence: parseJson<PlanEvidence>(p.evidence, {} as PlanEvidence),
    inputs: parseJson<PlanInputs>(p.inputs, { periodMinutes: 40, resources: "blackboard", language: "en", note: "" }),
    sections: parseJson<PlanSection[]>(p.sections, []),
    exitTicket: exit ? { id: exit.id, status: exit.status, title: exit.title } : null,
    students: students.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })),
    updatedAt: p.updatedAt.toISOString(),
    draftSavedAt: p.draftSavedAt?.toISOString() ?? null,
    mode: aiMode(),
  };
}
export type PlanData = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

export async function saveSections(planId: string, sections: PlanSection[]) {
  const p = await prisma.lessonPlan.findUniqueOrThrow({ where: { id: planId } });
  if (p.exitTicketAssessmentId) {
    const old = parseJson<PlanSection[]>(p.sections, []).find((s) => s.kind === "exit_ticket");
    const next = sections.find((s) => s.kind === "exit_ticket");
    if (JSON.stringify(old?.questions) !== JSON.stringify(next?.questions)) throw new Error("The exit ticket is already an assessment; its questions can no longer change.");
  }
  await prisma.lessonPlan.update({ where: { id: planId }, data: { sections: JSON.stringify(sections) } });
  await audit("teacher", "plan.edited", "LessonPlan", planId, { sections: sections.length });
}

/** "Save draft & leave": keeps the plan (with any unsaved edits) and stops asking on the way out. */
export async function savePlanDraft(planId: string, sections?: PlanSection[]) {
  if (sections) await saveSections(planId, sections);
  await prisma.lessonPlan.update({ where: { id: planId }, data: { draftSavedAt: new Date() } });
  await audit("teacher", "plan.draft_saved", "LessonPlan", planId, {});
}

/** "Discard": deletes a plan whose exit ticket has not become an assessment. */
export async function discardPlan(planId: string) {
  const p = await prisma.lessonPlan.findUnique({ where: { id: planId } });
  if (!p) return;
  if (p.exitTicketAssessmentId) throw new Error("This plan's exit ticket is already an assessment, so the plan cannot be discarded.");
  await prisma.lessonPlan.delete({ where: { id: planId } });
  await audit("teacher", "plan.discarded", "LessonPlan", planId, { conceptId: p.conceptId });
}

export async function regenerateSection(planId: string, sectionId: string) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found");
  const section = plan.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error("Section not found");
  if (section.kind === "exit_ticket" && plan.exitTicket) throw new Error("The exit ticket is already an assessment and cannot be regenerated.");
  const out = plan.mode === "live" ? await liveRegenerateSection(plan.evidence, plan.inputs, plan.sections, section) : mockRegenerateSection(plan.evidence, plan.inputs, section);
  let sections = plan.sections.map((s) => (s.id === sectionId ? { ...out, id: s.id } : s));
  if (section.kind === "peer_pairs") sections = await attachPairs(plan.section.id, plan.conceptId, sections, (section.pairs?.seed ?? 0) + 1);
  await prisma.lessonPlan.update({ where: { id: planId }, data: { sections: JSON.stringify(sections) } });
  await audit("ai", "plan.section_regenerated", "LessonPlan", planId, { kind: section.kind, mode: plan.mode });
}

export async function reshufflePairs(planId: string) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found");
  const current = plan.sections.find((s) => s.kind === "peer_pairs");
  const sections = await attachPairs(plan.section.id, plan.conceptId, plan.sections, (current?.pairs?.seed ?? 0) + 1);
  await prisma.lessonPlan.update({ where: { id: planId }, data: { sections: JSON.stringify(sections) } });
}

export async function setStatus(planId: string, status: "draft" | "ready" | "taught", taughtAt?: string) {
  await prisma.lessonPlan.update({
    where: { id: planId },
    data: { status, taughtAt: status === "taught" ? new Date(`${taughtAt ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`) : null },
  });
  await audit("teacher", `plan.${status}`, "LessonPlan", planId, { taughtAt });
}

/** The exit ticket becomes an assessment (type exit_ticket) that goes through the same grading flow. */
export async function createExitTicket(planId: string) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.exitTicket) return plan.exitTicket.id;
  if (plan.status !== "taught") throw new Error("Mark the plan as taught first.");
  const exit = plan.sections.find((s) => s.kind === "exit_ticket");
  if (!exit || exit.questions.length === 0) throw new Error("The plan has no exit-ticket questions.");
  const fixtureMatch =
    exit.questions.length === C8_EXIT_TICKET_TRANSPOSING.questions.length &&
    exit.questions.every((q, i) => q.text.trim() === C8_EXIT_TICKET_TRANSPOSING.questions[i].text);
  const id = `asm_${newId()}`;
  await prisma.assessment.create({
    data: {
      id,
      sectionId: plan.section.id,
      title: `Exit Ticket — ${plan.evidence.conceptName}`,
      type: "exit_ticket",
      date: new Date(`${(plan.taughtAt ?? new Date().toISOString()).slice(0, 10)}T00:00:00Z`),
      status: "questions_ready",
      lessonPlanId: plan.id,
      fixtureKey: fixtureMatch ? C8_EXIT_TICKET_TRANSPOSING.key : null,
      questionPaperKeys: JSON.stringify(fixtureMatch ? ["samples/papers/c8-et-transposing-paper.jpg"] : []),
      answerKeyKeys: JSON.stringify(fixtureMatch ? ["samples/papers/c8-et-transposing-key.jpg"] : []),
      questions: {
        create: exit.questions.map((q, i) => ({
          id: `q_${id}_${i + 1}`,
          number: i + 1,
          text: q.text,
          maxMarks: q.rubric.reduce((s, r) => s + r.marks, 0) || q.marks,
          rubric: JSON.stringify(q.rubric.length ? q.rubric : [{ step: "Correct answer", marks: q.marks }]),
          conceptIds: JSON.stringify([plan.conceptId]),
          answerKey: q.answer,
        })),
      },
    },
  });
  await prisma.lessonPlan.update({ where: { id: planId }, data: { exitTicketAssessmentId: id } });
  await audit("teacher", "plan.exit_ticket_created", "LessonPlan", planId, { assessmentId: id });
  return id;
}
