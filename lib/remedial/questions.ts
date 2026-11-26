/**
 * Remedial question selection and mistake citations: pure functions over a section dataset, shared by the
 * remedial service (database) and the scripted walkthrough (fixtures).
 */
import { DatasetIndex, type SectionDataset } from "../diagnosis/dataset";
import type { FlagEvidence } from "../diagnosis/flags";
import { TRANSPOSING_REMEDIAL_BANK } from "../fixtures/papers";
import type { RubricStep } from "../domain";

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

/** `collectMistakes` over a section dataset (pure). */
export function collectMistakesFromDataset(ds: SectionDataset, studentIds: string[], conceptIds: string[]): MistakeEvidence[] {
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

export type BankItem = Omit<RemedialQuestion, "id" | "targetsMistake" | "sourceAssessmentId" | "sourceQuestionNumber"> & { tags?: string[] };

/** The hand-written practice bank for a concept, if there is one (Transposing terms). */
export function fixtureBank(conceptId: string): BankItem[] | null {
  if (conceptId !== "c8-le-transposing") return null;
  return TRANSPOSING_REMEDIAL_BANK.map((q, i) => ({ text: q.text, answer: q.answerKey, marks: q.maxMarks, rubric: q.rubric, difficulty: i < 3 ? 1 : i < 7 ? 2 : 3, conceptId, tags: q.conceptIds }));
}

/** Mock-mode question selection (pure): picks from each concept's bank, easier → harder, and cites a real mistake for each. */
export function assembleRemedial(perConcept: BankItem[][], studentIds: string[], count: number, mistakes: MistakeEvidence[], makeId: () => string): RemedialQuestion[] {
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
      id: makeId(),
      targetsMistake: d ? citeMistake(d.m, group ? { count: d.count } : null) : "Practice on a concept where marks were lost.",
      sourceAssessmentId: d?.m.assessmentId ?? null,
      sourceQuestionNumber: d?.m.questionNumber ?? null,
    };
  });
}

/** The concept a flag's remedial sheet starts from: where marks went with a named misconception (pure). */
export function conceptsFromFlagEvidence(ev: FlagEvidence | null): string[] {
  const withMisconception = new Set((ev?.questionBreakdown ?? []).filter((q) => q.misconception).flatMap((q) => q.concepts));
  const concepts = (ev?.conceptBreakdown ?? []).filter((c) => c.marksLost > 0);
  const preferred = concepts.filter((c) => withMisconception.has(c.name));
  return (preferred.length ? preferred : concepts).slice(0, 1).map((c) => c.conceptId);
}
