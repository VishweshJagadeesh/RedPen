/** Shared domain types. Database rows store JSON as strings; these are the parsed shapes. */

export const ASSESSMENT_TYPES = ["weekly_test", "periodic_test", "term_exam", "homework", "remedial", "exit_ticket"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export const REGULAR_TYPES: AssessmentType[] = ["weekly_test", "periodic_test", "term_exam"];

export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  weekly_test: "Weekly test",
  periodic_test: "Periodic test",
  term_exam: "Term exam",
  homework: "Homework",
  remedial: "Remedial",
  exit_ticket: "Exit ticket",
};

export type AssessmentStatus = "draft" | "questions_ready" | "sheets_uploaded" | "grading" | "in_review" | "final";

export const MISTAKE_TYPES = [
  "conceptual",
  "procedural",
  "calculation",
  "incomplete",
  "unattempted",
  "illegible",
  "none",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_LABEL: Record<MistakeType, string> = {
  conceptual: "Conceptual",
  procedural: "Procedural",
  calculation: "Calculation slip",
  incomplete: "Incomplete",
  unattempted: "Unattempted",
  illegible: "Illegible",
  none: "No mistake",
};

export type GradeStatus = "pending_review" | "accepted" | "overridden";
export type SubmissionStatus = "uploaded" | "matched" | "grading" | "graded" | "error" | "absent";

export type FlagType = "sudden_drop" | "missed_submissions" | "concept_regression";
export type FlagStatus = "open" | "action_taken" | "improving" | "resolved";
export const FLAG_TYPE_LABEL: Record<FlagType, string> = {
  sudden_drop: "Sudden drop",
  missed_submissions: "Missed submissions",
  concept_regression: "Concept regression",
};
export const FLAG_STATUS_LABEL: Record<FlagStatus, string> = {
  open: "Open",
  action_taken: "Action taken",
  improving: "Improving",
  resolved: "Resolved",
};

export type PlanStatus = "draft" | "ready" | "taught";
export type ConfidenceBand = "high" | "medium" | "low";

export interface RubricStep {
  step: string;
  marks: number;
}

export interface StepAward {
  step: string;
  marks: number;
  awarded: number;
  note?: string;
}

/** Normalised crop rectangle (0..1) on a page image. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Raw signals that feed the confidence score. */
export interface ConfidenceSignals {
  passAMarks: number;
  passBMarks: number;
  maxMarks: number;
  /** 0..1, 1 = perfectly legible */
  legibility: number;
  /** Parts of the transcription the reader was unsure about, e.g. "digit in step 2". */
  uncertainSpans: string[];
  /** 0..1, how ambiguous the answer key is for this answer (e.g. an unexpected valid method). */
  keyAmbiguity: number;
  /** The grader's own confidence, 0..1. Used only as a minor signal. */
  selfConfidence: number;
  injectionDetected: boolean;
  crossedOut?: boolean;
  mixedLanguage?: boolean;
  stepDisagreements?: string[];
}

export interface GradingPassSummary {
  pass: "A" | "B";
  marks: number;
  steps: StepAward[];
  mistakeType: MistakeType;
  misconception: string | null;
}

export interface Snippet {
  text: string;
  assessmentTitle: string;
  questionNumber: number;
}
