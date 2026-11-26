/** The weak-concept card's view of a class concept summary (pure; shared by the class page and the walkthrough). */
import { config } from "../config";
import type { ClassConceptSummary } from "./mastery";

export interface WeakConceptView {
  conceptId: string;
  conceptName: string;
  chapter: string;
  isWeak: boolean;
  studentsUnder: number;
  studentsAssessed: number;
  shareUnder: number;
  meanPct: number;
  assessmentTitle: string;
  /** "homework" when the latest evidence came from homework rather than a test. */
  source: "test" | "homework" | "exit_ticket";
  misconceptions: { label: string; count: number }[];
  snippets: { text: string; misconception: string; source: string }[];
  weakStudentIds: string[];
  plan: null | {
    id: string;
    status: string;
    taughtAt: string | null;
    exitTicketAssessmentId: string | null;
    exitTicketStatus: string | null;
    beforePct: number;
    afterPct: number | null;
    afterUnder: number | null;
    afterAssessed: number | null;
  };
}

export function toWeakConceptView(s: ClassConceptSummary): Omit<WeakConceptView, "plan"> {
  return {
    conceptId: s.conceptId,
    conceptName: s.conceptName,
    chapter: s.chapter,
    isWeak: s.isWeak,
    studentsUnder: s.studentsUnder,
    studentsAssessed: s.studentsAssessed,
    shareUnder: s.shareUnder,
    meanPct: s.meanPct,
    assessmentTitle: s.assessmentTitle,
    source: s.assessmentType === "homework" ? "homework" : s.assessmentType === "exit_ticket" ? "exit_ticket" : "test",
    misconceptions: s.misconceptions,
    snippets: s.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
    weakStudentIds: s.perStudent.filter((p) => p.pct < config.diagnosis.weakScore).map((p) => p.studentId),
  };
}

