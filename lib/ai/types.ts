import type { Crop, MistakeType, StepAward } from "../domain";
import type { StoredFile } from "../storage";
import type { ParsedPaper } from "./schemas";

export interface CallMeta {
  mode: "live" | "mock";
  model: string;
  latencyMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export function emptyMeta(mode: "live" | "mock", model = "mock"): CallMeta {
  return { mode, model, latencyMs: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, calls: 0 };
}

export function addMeta(a: CallMeta, b: Partial<CallMeta>): CallMeta {
  return {
    ...a,
    model: b.model ?? a.model,
    latencyMs: a.latencyMs + (b.latencyMs ?? 0),
    costUsd: a.costUsd + (b.costUsd ?? 0),
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
    calls: a.calls + (b.calls ?? 1),
  };
}

export interface ConceptRef {
  id: string;
  name: string;
  chapter: string;
}

export interface PaperInput {
  paperKeys: string[];
  keyKeys: string[];
  paperFiles: StoredFile[];
  keyFiles: StoredFile[];
  fixtureKey: string | null;
  concepts: ConceptRef[];
}

export interface HeaderInput {
  pageKey: string;
  page: StoredFile;
}

export interface HeaderResult {
  isFirstPage: boolean;
  name: string | null;
  roll: number | null;
}

export interface QuestionForGrading {
  id: string;
  number: number;
  text: string;
  maxMarks: number;
  rubric: { step: string; marks: number }[];
  answerKey: string;
  conceptIds: string[];
  /** Known misconception labels for this question's concepts. */
  misconceptions: string[];
}

export interface GradeSheetInput {
  sheetRef: string | null;
  pageKeys: string[];
  pages: StoredFile[];
  questions: QuestionForGrading[];
  concepts: ConceptRef[];
}

export interface PassResult {
  steps: StepAward[];
  mistakeType: MistakeType;
  misconception: string | null;
  conceptIds: string[];
  reasoning: string;
  keyAmbiguity: number;
  selfConfidence: number;
}

export interface AnswerResult {
  questionNumber: number;
  pageIndex: number;
  crop: Crop;
  transcription: string;
  legibility: number;
  uncertainSpans: string[];
  crossedOut: boolean;
  mixedLanguage: boolean;
  containsInstructions: boolean;
  passA: PassResult;
  passB: PassResult;
}

export interface GradeSheetResult {
  answers: AnswerResult[];
  meta: CallMeta;
}

export interface ParsePaperResult {
  paper: ParsedPaper;
  meta: CallMeta;
}
