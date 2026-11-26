/** Review-queue items from stored grade rows: pure mapping shared by the review page and the walkthrough. */
import { parseJson } from "../db/json";
import { bandFor, BAND_ORDER } from "./confidence";
import type { ConfidenceBand, Crop, GradeStatus, MistakeType, RubricStep, StepAward } from "../domain";

/** Marks that count: the teacher's override when there is one, otherwise the AI's. */
export function effectiveMarks(g: { status: string; awardedMarks: number; teacherMarks: number | null }): number {
  return g.status === "overridden" && g.teacherMarks !== null ? g.teacherMarks : g.awardedMarks;
}

export interface ReviewItem {
  id: string;
  submissionId: string;
  studentName: string;
  rollNumber: number | null;
  questionNumber: number;
  questionText: string;
  answerKey: string;
  rubric: RubricStep[];
  maxMarks: number;
  steps: StepAward[];
  teacherSteps: StepAward[] | null;
  awardedMarks: number;
  teacherMarks: number | null;
  finalMarks: number;
  transcription: string;
  pageUrl: string | null;
  crop: Crop | null;
  aiReasoning: string;
  confidence: number;
  band: ConfidenceBand;
  reasons: string[];
  passes: { pass: "A" | "B"; marks: number }[];
  mistakeType: MistakeType;
  misconception: string | null;
  status: GradeStatus;
  teacherNote: string | null;
  needsRescan: boolean;
}

/** One stored grade row → a review item (pure). JSON columns are strings, as stored. */
export function reviewItemFrom(
  g: {
    id: string;
    maxMarks: number;
    steps: string;
    teacherSteps: string | null;
    awardedMarks: number;
    teacherMarks: number | null;
    status: string;
    transcription: string;
    crop: string | null;
    aiReasoning: string;
    confidence: number;
    confidenceReasons: string;
    passes: string;
    mistakeType: string;
    misconception: string | null;
    teacherNote: string | null;
    needsRescan: boolean;
  },
  q: { number: number; text: string; answerKey: string; rubric: string },
  s: { id: string; student: { name: string; rollNumber: number } | null; pageUrl: string | null },
): ReviewItem {
  const crop = parseJson<Crop | null>(g.crop, null);
  return {
    id: g.id,
    submissionId: s.id,
    studentName: s.student?.name ?? "Unmatched sheet",
    rollNumber: s.student?.rollNumber ?? null,
    questionNumber: q.number,
    questionText: q.text,
    answerKey: q.answerKey,
    rubric: parseJson<RubricStep[]>(q.rubric, []),
    maxMarks: g.maxMarks,
    steps: parseJson<StepAward[]>(g.steps, []),
    teacherSteps: g.teacherSteps ? parseJson<StepAward[]>(g.teacherSteps, []) : null,
    awardedMarks: g.awardedMarks,
    teacherMarks: g.teacherMarks,
    finalMarks: effectiveMarks(g),
    transcription: g.transcription,
    pageUrl: s.pageUrl,
    crop: crop && "w" in crop ? crop : null,
    aiReasoning: g.aiReasoning,
    confidence: g.confidence,
    band: bandFor(g.confidence),
    reasons: parseJson<string[]>(g.confidenceReasons, []),
    passes: parseJson<{ pass: "A" | "B"; marks: number }[]>(g.passes, []).map((p) => ({ pass: p.pass, marks: p.marks })),
    mistakeType: g.mistakeType as MistakeType,
    misconception: g.misconception,
    status: g.status as GradeStatus,
    teacherNote: g.teacherNote,
    needsRescan: g.needsRescan,
  };
}

/** Low first, then Medium, then High; least confident first within a band (in place). */
export function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return items.sort((x, y) => BAND_ORDER[x.band] - BAND_ORDER[y.band] || x.confidence - y.confidence || (x.rollNumber ?? 999) - (y.rollNumber ?? 999) || x.questionNumber - y.questionNumber);
}

