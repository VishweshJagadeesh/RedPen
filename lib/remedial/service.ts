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

export interface RemedialQuestion {
  id: string;
  text: string;
  answer: string;
  marks: number;
  rubric: RubricStep[];
  difficulty: number;
  conceptId: string;
  targetsMistake: string;
  sourceAssessmentId: string | null;
  sourceQuestionNumber: number | null;
}

export interface MistakeEvidence {
  studentId: string;
  conceptId: string;
  assessmentId: string;
  assessmentTitle: string;
  date: string;
  questionNumber: number;
  questionConcepts: string[];
  transcription: string;
  misconception: string | null;
  mistakeType: string;
  marks: number;
  maxMarks: number;
}

const newId = () => crypto.randomBytes(5).toString("hex");

/** Every answer where the student lost marks on one of the concepts, most recent first. */
export async function collectMistakes(sectionId: string, studentIds: string[], conceptIds: string[]): Promise<MistakeEvidence[]> {
  const ds = await loadSectionDataset(sectionId);
  const out: MistakeEvidence[] = [];
  const idx = new DatasetIndex(ds);
  for (const a of [...ds.assessments].reverse()) {
    for (const sid of studentIds) {
      for (const cid of conceptIds) {
        for (const { q, ans } of idx.answersOnConcept(a.id, sid, cid)) {
          if (ans.marks >= ans.maxMarks) continue;
          out.push({
            studentId: sid,
            conceptId: cid,
            assessmentId: a.id,
            assessmentTitle: a.title,
            date: a.date,
            questionNumber: q.number,
            questionConcepts: q.conceptIds,
            transcription: ans.transcription,
            misconception: ans.misconception,
            mistakeType: ans.mistakeType,
            marks: ans.marks,
            maxMarks: ans.maxMarks,
          });
        }
      }
    }
  }
  // Named misconceptions first (they say what went wrong), then blanks.
  return out.sort((x, y) => Number(!!y.misconception) - Number(!!x.misconception) || (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

function firstLine(t: string) {
  return t.split("\n").find((l) => !l.startsWith("(crossed out)"))?.trim() ?? "";
}

export function citeMistake(m: MistakeEvidence, group: { count: number } | null): string {
  const where = `In ${m.assessmentTitle}, Q${m.questionNumber}`;
  if (group) {
    return m.misconception
      ? `${where}: ${group.count} students in the group — ${m.misconception.toLowerCase()} (e.g. "${firstLine(m.transcription)}").`
      : `${where}: ${group.count} students in the group left this type of question unattempted.`;
  }
  if (m.mistakeType === "unattempted" || !m.transcription.trim()) return `${where}, you left this type of question blank.`;
  if (m.misconception && /without changing its sign/i.test(m.misconception)) return `${where}, you moved a term across the equals sign without changing its sign (you wrote ${firstLine(m.transcription)}).`;
  if (m.misconception && /one side only/i.test(m.misconception)) return `${where}, you did an operation on one side only (you wrote ${firstLine(m.transcription)}).`;
  if (m.misconception && /slip/i.test(m.misconception)) return `${where}, your method was right but an arithmetic slip cost marks (you wrote ${firstLine(m.transcription)}).`;
  if (m.misconception) return `${where}: ${m.misconception.toLowerCase()} (you wrote ${firstLine(m.transcription)}).`;
  return `${where}, you lost ${m.maxMarks - m.marks} of ${m.maxMarks} marks.`;
}

type BankItem = Omit<RemedialQuestion, "id" | "targetsMistake" | "sourceAssessmentId" | "sourceQuestionNumber"> & { tags?: string[] };

async function bankFor(sectionId: string, conceptId: string): Promise<BankItem[]> {
  if (conceptId === "c8-le-transposing") {
    return TRANSPOSING_REMEDIAL_BANK.map((q, i) => ({ text: q.text, answer: q.answerKey, marks: q.maxMarks, rubric: q.rubric, difficulty: i < 3 ? 1 : i < 7 ? 2 : 3, conceptId, tags: q.conceptIds }));
  }
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
  const picked: BankItem[] = [];
  for (let i = 0; picked.length < count && i < 20; i++) for (const bank of perConcept) if (bank[i] && picked.length < count) picked.push(bank[i]);
  picked.sort((a, b) => a.difficulty - b.difficulty);
  const group = studentIds.length > 1;
  // For a group, describe each distinct mistake once with how many students made it.
  const distinct: { m: MistakeEvidence; count: number }[] = [];
  for (const m of mistakes) {
    const key = `${m.assessmentId}:${m.questionNumber}:${m.misconception ?? m.mistakeType}`;
    const hit = distinct.find((d) => `${d.m.assessmentId}:${d.m.questionNumber}:${d.m.misconception ?? d.m.mistakeType}` === key);
    if (hit) hit.count++;
    else distinct.push({ m, count: 1 });
  }
  if (group) distinct.sort((a, b) => b.count - a.count);
  // Match each question to the mistake it fits best: same extra concept tags first (e.g. variables on
  // both sides), then rotate through the rest so the sheet covers every distinct mistake.
  const used = new Map<string, number>();
  const keyOf = (d: { m: MistakeEvidence }) => `${d.m.assessmentId}:${d.m.questionNumber}`;
  return picked.map(({ tags, ...q }) => {
    const pool = distinct.filter((d) => d.m.conceptId === q.conceptId);
    const candidates = pool.length ? pool : distinct;
    const extra = (tags ?? []).filter((t) => t !== q.conceptId);
    const score = (d: { m: MistakeEvidence }) => {
      const overlap = extra.length ? extra.filter((t) => d.m.questionConcepts.includes(t)).length : 0;
      const extraOnSource = d.m.questionConcepts.filter((t) => t !== q.conceptId).length;
      return overlap * 10 - (extra.length === 0 ? extraOnSource * 5 : 0) - (used.get(keyOf(d)) ?? 0) * 3;
    };
    const d = [...candidates].sort((a, b) => score(b) - score(a))[0];
    if (d) used.set(keyOf(d), (used.get(keyOf(d)) ?? 0) + 1);
    return {
      ...q,
      id: newId(),
      targetsMistake: d ? citeMistake(d.m, group ? { count: d.count } : null) : "Practice on a concept where marks were lost.",
      sourceAssessmentId: d?.m.assessmentId ?? null,
      sourceQuestionNumber: d?.m.questionNumber ?? null,
    };
  });
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
  const withMisconception = new Set((ev?.questionBreakdown ?? []).filter((q) => q.misconception).flatMap((q) => q.concepts));
  const concepts = (ev?.conceptBreakdown ?? []).filter((c) => c.marksLost > 0);
  const preferred = concepts.filter((c) => withMisconception.has(c.name));
  const pick = (preferred.length ? preferred : concepts).slice(0, 1).map((c) => c.conceptId);
  return { sectionId: f.sectionId, studentIds: [f.studentId], conceptIds: pick, flagId };
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
