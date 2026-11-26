/**
 * Targeted remedial assignments. Questions run from easier to harder, each tagged to a concept and
 * citing the actual mistake it targets (assessment, question and what was written).
 */
import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { aiMode, planningModel } from "../ai/mode";
import { AiError, callStructured } from "../ai/client";
import { RemedialSetSchema } from "../ai/schemas";
import { audit } from "../audit";
import { DatasetIndex } from "../diagnosis/dataset";
import { classConceptSummary, studentConceptMastery } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import { TRANSPOSING_REMEDIAL_BANK } from "../fixtures/papers";
import type { RubricStep } from "../domain";
import { loadSectionDataset } from "../queries/dataset";
import { addFlagHistory } from "../services/followups";
import {
  assembleRemedial,
  citeMistake,
  collectMistakesFromDataset,
  conceptsFromFlagEvidence,
  fixtureBank,
  type BankItem,
  type MistakeEvidence,
  type RemedialQuestion,
} from "./questions";

export { assembleRemedial, citeMistake, collectMistakesFromDataset, conceptsFromFlagEvidence, fixtureBank };
export type { BankItem, MistakeEvidence, RemedialQuestion };


const newId = () => crypto.randomBytes(5).toString("hex");

/** Every answer where the student lost marks on one of the concepts, most recent first. */
export async function collectMistakes(sectionId: string, studentIds: string[], conceptIds: string[]): Promise<MistakeEvidence[]> {
  return collectMistakesFromDataset(await loadSectionDataset(sectionId), studentIds, conceptIds);
}

async function bankFor(sectionId: string, conceptId: string): Promise<BankItem[]> {
  const fixed = fixtureBank(conceptId);
  if (fixed) return fixed;
  // Fallback: practise the class's own test questions on this concept, easiest (fewest marks) first.
  const qs = await prisma.question.findMany({ where: { assessment: { sectionId, status: "final" } }, orderBy: [{ maxMarks: "asc" }, { number: "asc" }] });
  const seen = new Set<string>();
  return qs
    .filter((q) => parseJson<string[]>(q.conceptIds, []).includes(conceptId))
    .filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true)))
    .map((q, i, arr) => ({
      text: q.text,
      answer: q.answerKey,
      marks: q.maxMarks,
      rubric: parseJson<RubricStep[]>(q.rubric, []),
      difficulty: i < arr.length / 3 ? 1 : i < (2 * arr.length) / 3 ? 2 : 3,
      conceptId,
      tags: parseJson<string[]>(q.conceptIds, []),
    }));
}

async function mockGenerate(sectionId: string, studentIds: string[], conceptIds: string[], count: number, mistakes: MistakeEvidence[]): Promise<RemedialQuestion[]> {
  const perConcept = await Promise.all(conceptIds.map((c) => bankFor(sectionId, c)));
  return assembleRemedial(perConcept, studentIds, count, mistakes, newId);
}

async function liveGenerate(conceptNames: Record<string, string>, studentCount: number, count: number, mistakes: MistakeEvidence[]): Promise<RemedialQuestion[]> {
  const evidence = mistakes.slice(0, 20).map((m) => ({
    assessmentId: m.assessmentId,
    assessment: m.assessmentTitle,
    questionNumber: m.questionNumber,
    concept: conceptNames[m.conceptId] ?? m.conceptId,
    conceptId: m.conceptId,
    whatWasWritten: m.transcription,
    misconception: m.misconception,
    mistakeType: m.mistakeType,
  }));
  const res = await callStructured({
    label: "remedial questions",
    model: planningModel(),
    system:
      "You write short remedial practice for Class 8–9 mathematics students in India (CBSE). Each question must target one of the student's actual mistakes listed in the evidence and cite it in targetsMistake, addressing the student as 'you' (or 'students in the group' for a group sheet). Never invent mistakes, tests or question numbers.",
    content: [
      {
        type: "text",
        text: `Target concepts: ${Object.entries(conceptNames).map(([id, n]) => `${id} (${n})`).join(", ")}.
Sheet for ${studentCount === 1 ? "one student" : `a group of ${studentCount} students`}. Write exactly ${count} questions, ordered from easier to harder (difficulty 1–3), each with an answer and a step rubric.
Evidence (their actual answers):\n${JSON.stringify(evidence, null, 2)}`,
      },
    ],
    schema: RemedialSetSchema,
  });
  const valid = new Set(mistakes.map((m) => `${m.assessmentId}:${m.questionNumber}`));
  const qs = res.data.questions.filter((q) => q.sourceAssessmentId && q.sourceQuestionNumber && valid.has(`${q.sourceAssessmentId}:${q.sourceQuestionNumber}`));
  if (qs.length < Math.min(5, count)) throw new AiError("Some generated questions did not cite a real mistake. Nothing was saved; try again.", "remedial questions", 2);
  return qs
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((q) => ({ ...q, id: newId(), marks: q.rubric.reduce((s, r) => s + r.marks, 0) || q.marks, conceptId: conceptNames[q.conceptId] ? q.conceptId : Object.keys(conceptNames)[0] }));
}

/** Prefill from a flag: the student, and the concepts where their marks went with a named misconception. */
export async function prefillFromFlag(flagId: string) {
  const f = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
  const ev = parseJson<FlagEvidence | null>(f.evidence, null);
  return { sectionId: f.sectionId, studentIds: [f.studentId], conceptIds: conceptsFromFlagEvidence(ev), flagId };
}

export async function prefillFromGroup(sectionId: string, conceptId: string) {
  const ds = await loadSectionDataset(sectionId);
  const s = classConceptSummary(new DatasetIndex(ds), conceptId);
  return { sectionId, studentIds: s ? s.perStudent.filter((p) => p.pct < 50).map((p) => p.studentId) : [], conceptIds: [conceptId], flagId: null as string | null };
}

export async function prefillForStudents(sectionId: string, studentIds: string[]) {
  const ds = await loadSectionDataset(sectionId);
  const idx = new DatasetIndex(ds);
  const scored = ds.concepts
    .map((c) => {
      const vals = studentIds.map((s) => studentConceptMastery(idx, s, c.id)?.pct).filter((v): v is number => v !== undefined);
      return { id: c.id, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 101 };
    })
    .sort((a, b) => a.avg - b.avg);
  return { sectionId, studentIds, conceptIds: scored.slice(0, 1).filter((x) => x.avg < 100).map((x) => x.id), flagId: null as string | null };
}

export async function createRemedial(input: { sectionId: string; studentIds: string[]; conceptIds: string[]; count: number; mode: "group" | "individual"; flagId: string | null }) {
  if (input.studentIds.length === 0) throw new Error("Choose at least one student.");
  if (input.conceptIds.length === 0) throw new Error("Choose at least one target concept.");
  const count = Math.max(5, Math.min(10, input.count));
  const concepts = await prisma.concept.findMany({ where: { id: { in: input.conceptIds } } });
  const names = Object.fromEntries(concepts.map((c) => [c.id, c.name]));
  const students = await prisma.student.findMany({ where: { id: { in: input.studentIds } }, orderBy: { rollNumber: "asc" } });
  const groups = input.mode === "individual" ? students.map((s) => [s]) : [students];
  const ids: string[] = [];
  for (const group of groups) {
    const studentIds = group.map((s) => s.id);
    const mistakes = await collectMistakes(input.sectionId, studentIds, input.conceptIds);
    const started = Date.now();
    const questions = aiMode() === "live" ? await liveGenerate(names, studentIds.length, count, mistakes) : await mockGenerate(input.sectionId, studentIds, input.conceptIds, count, mistakes);
    const id = `rem_${newId()}`;
    const who = group.length === 1 ? group[0].name : `${group.length} students`;
    await prisma.remedialAssignment.create({
      data: {
        id,
        sectionId: input.sectionId,
        title: `Remedial — ${concepts.map((c) => c.name).join(", ")} — ${who}`,
        flagId: group.length === 1 && input.flagId ? input.flagId : null,
        studentIds: JSON.stringify(studentIds),
        conceptIds: JSON.stringify(input.conceptIds),
        questions: JSON.stringify(questions),
        status: "draft",
      },
    });
    await audit("ai", "remedial.generated", "RemedialAssignment", id, { mode: aiMode(), students: studentIds.length, questions: questions.length, latencyMs: Date.now() - started });
    ids.push(id);
  }
  return ids;
}

export async function getRemedial(id: string) {
  const r = await prisma.remedialAssignment.findUnique({ where: { id }, include: { section: true } });
  if (!r) return null;
  const studentIds = parseJson<string[]>(r.studentIds, []);
  const conceptIds = parseJson<string[]>(r.conceptIds, []);
  const [students, concepts, assessment] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, orderBy: { rollNumber: "asc" } }),
    prisma.concept.findMany({ where: { id: { in: conceptIds } } }),
    r.assessmentId ? prisma.assessment.findUnique({ where: { id: r.assessmentId } }) : null,
  ]);
  return {
    id: r.id,
    title: r.title,
    status: r.status as "draft" | "assigned" | "graded",
    section: { id: r.section.id, name: r.section.name },
    flagId: r.flagId,
    students: students.map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })),
    concepts: concepts.map((c) => ({ id: c.id, name: c.name })),
    questions: parseJson<RemedialQuestion[]>(r.questions, []),
    assessment: assessment ? { id: assessment.id, status: assessment.status } : null,
    draftSavedAt: r.draftSavedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    mode: aiMode(),
  };
}
export type RemedialData = NonNullable<Awaited<ReturnType<typeof getRemedial>>>;

export async function saveRemedialQuestions(id: string, questions: RemedialQuestion[]) {
  const r = await prisma.remedialAssignment.findUniqueOrThrow({ where: { id } });
  if (r.status !== "draft") throw new Error("This sheet has been assigned; its questions can no longer change.");
  if (questions.length === 0) throw new Error("Keep at least one question.");
  await prisma.remedialAssignment.update({ where: { id }, data: { questions: JSON.stringify(questions) } });
  await audit("teacher", "remedial.edited", "RemedialAssignment", id, { questions: questions.length });
}

/** "Save draft & leave": keeps the sheet (with any unsaved edits) and stops asking on the way out. */
export async function saveRemedialDraft(id: string, questions?: RemedialQuestion[]) {
  if (questions) await saveRemedialQuestions(id, questions);
  await prisma.remedialAssignment.update({ where: { id }, data: { draftSavedAt: new Date() } });
  await audit("teacher", "remedial.draft_saved", "RemedialAssignment", id, {});
}

/** "Discard": deletes a sheet that was never assigned. */
export async function discardRemedial(id: string) {
  const r = await prisma.remedialAssignment.findUnique({ where: { id } });
  if (!r) return;
  if (r.status !== "draft" || r.assessmentId) throw new Error("This sheet has been assigned and can no longer be discarded.");
  await prisma.remedialAssignment.delete({ where: { id } });
  await audit("teacher", "remedial.discarded", "RemedialAssignment", id, { title: r.title });
}

/** Assign: the sheet becomes a remedial assessment (graded through the same flow) and shows as pending. */
export async function assignRemedial(id: string) {
  const r = await getRemedial(id);
  if (!r) throw new Error("Not found");
  if (r.assessment) return r.assessment.id;
  const assessmentId = `asm_${newId()}`;
  const bankMatch = r.questions.every((q, i) => TRANSPOSING_REMEDIAL_BANK[i]?.text === q.text && q.rubric.length === TRANSPOSING_REMEDIAL_BANK[i].rubric.length);
  await prisma.assessment.create({
    data: {
      id: assessmentId,
      sectionId: r.section.id,
      title: r.title.replace(/^Remedial —/, "Remedial sheet —"),
      type: "remedial",
      date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      status: "questions_ready",
      remedialAssignmentId: r.id,
      fixtureKey: bankMatch ? "remedial-transposing" : null,
      questions: {
        create: r.questions.map((q, i) => ({
          id: `q_${assessmentId}_${i + 1}`,
          number: i + 1,
          text: q.text,
          maxMarks: q.rubric.reduce((s, x) => s + x.marks, 0) || q.marks,
          rubric: JSON.stringify(q.rubric.length ? q.rubric : [{ step: "Correct answer with working", marks: q.marks }]),
          conceptIds: JSON.stringify([q.conceptId]),
          answerKey: q.answer,
        })),
      },
    },
  });
  await prisma.remedialAssignment.update({ where: { id }, data: { status: "assigned", assignedAt: new Date(), assessmentId } });
  await audit("teacher", "remedial.assigned", "RemedialAssignment", id, { assessmentId, students: r.students.length });
  if (r.flagId) {
    const f = await prisma.flag.findUnique({ where: { id: r.flagId } });
    if (f && f.status === "open") await addFlagHistory(f.id, "action_taken", `Remedial sheet assigned: ${r.questions.length} questions on ${r.concepts.map((c) => c.name).join(", ")}.`);
  }
  return assessmentId;
}

/** Personal "why this sheet" lines for a printed sheet (each student's own mistakes only). */
export async function personalCitations(sectionId: string, studentId: string, conceptIds: string[]) {
  const mistakes = await collectMistakes(sectionId, [studentId], conceptIds);
  const seen = new Set<string>();
  return mistakes
    .filter((m) => (seen.has(`${m.assessmentId}:${m.questionNumber}`) ? false : (seen.add(`${m.assessmentId}:${m.questionNumber}`), true)))
    .slice(0, 3)
    .map((m) => citeMistake(m, null));
}
