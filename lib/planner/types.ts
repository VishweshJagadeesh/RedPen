import type { PlanSectionKindT } from "../ai/schemas";
import type { RubricStep } from "../domain";

export type PlanLanguage = "en" | "hi" | "mixed";
export type PlanResource = "blackboard" | "projector" | "worksheets";

export interface PlanInputs {
  periodMinutes: number;
  resources: PlanResource;
  language: PlanLanguage;
  note: string;
}

export interface PlanQuestion {
  text: string;
  answer: string;
  marks: number;
  rubric: RubricStep[];
}

export interface PeerGroup {
  mentorId: string;
  mentorName: string;
  mentorPct: number;
  learners: { id: string; name: string; pct: number }[];
}

export interface PlanSection {
  id: string;
  kind: PlanSectionKindT;
  title: string;
  minutes: number;
  body: string;
  citesMisconceptions: string[];
  questions: PlanQuestion[];
  pairs?: { groups: PeerGroup[]; unpaired: { id: string; name: string; pct: number }[]; seed: number };
  variant?: number;
}

/** What the plan is based on: this class's actual results on the concept (no student names). */
export interface PlanEvidence {
  conceptId: string;
  conceptName: string;
  chapter: string;
  assessmentId: string;
  assessmentTitle: string;
  studentsAssessed: number;
  studentsUnder: number;
  meanPct: number;
  misconceptions: { label: string; count: number }[];
  snippets: { text: string; misconception: string; source: string }[];
  mentors: number;
  learners: number;
  /** Questions from the test that covered the concept, used as a fallback exit-ticket bank. */
  sourceQuestions: PlanQuestion[];
}

/** Timed teaching steps, in the order Teaching mode walks through them. */
export const TIMED_KINDS: PlanSectionKindT[] = ["prerequisite_check", "hook", "explanation", "worked_example", "misconception", "guided_practice", "exit_ticket_step"];

export const KIND_LABEL: Record<PlanSectionKindT, string> = {
  objective: "Learning objective",
  prerequisite_check: "Prerequisite check",
  hook: "Hook",
  explanation: "Explanation",
  worked_example: "Worked example",
  misconception: "Tackle a misconception",
  guided_practice: "Guided practice",
  exit_ticket_step: "Exit ticket (in class)",
  board_plan: "Board plan",
  peer_pairs: "Peer pairs",
  extension: "Extension work",
  exit_ticket: "Exit ticket questions",
};
