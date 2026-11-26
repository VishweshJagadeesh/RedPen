/** The evidence a reteach plan is built from, computed from a section dataset (pure, no database). */
import { DatasetIndex, type SectionDataset } from "../diagnosis/dataset";
import { classConceptSummary, suggestPeerPairs } from "../diagnosis/mastery";
import type { PlanEvidence, PlanQuestion } from "./types";

/**
 * The evidence snapshot for a plan, from a section dataset (pure). `sourceQuestions` are the questions of
 * the latest assessment that covered the concept. Returns null when there is no graded evidence.
 */
export function evidenceFromDataset(ds: SectionDataset, conceptId: string, sourceQuestions: PlanQuestion[]) {
  const s = classConceptSummary(new DatasetIndex(ds), conceptId);
  if (!s) return null;
  const pairs = suggestPeerPairs(s, ds.students);
  const evidence: PlanEvidence = {
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
  };
  return { summary: s, students: ds.students, evidence };
}
