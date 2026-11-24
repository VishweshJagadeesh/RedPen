/**
 * Mock AI: deterministic fixture outputs keyed by sheet and question. The whole app works in this
 * mode without an API key. Anything outside the fixtures gets an honest placeholder in the Low band.
 */
import { config } from "../config";
import { PAPER_BY_KEY } from "../fixtures/papers";
import { SAMPLE_PAPERS, mockSheets, sheetForPageKey } from "../fixtures/sheets";
import type { ParsedPaper } from "./schemas";
import {
  emptyMeta,
  type AnswerResult,
  type GradeSheetInput,
  type GradeSheetResult,
  type HeaderInput,
  type HeaderResult,
  type PaperInput,
  type ParsePaperResult,
  type PassResult,
} from "./types";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fixtureKeyForPaper(input: PaperInput): string | null {
  if (input.fixtureKey && PAPER_BY_KEY[input.fixtureKey]) return input.fixtureKey;
  for (const [key, files] of Object.entries(SAMPLE_PAPERS)) {
    if (input.paperKeys.some((k) => files.paper.includes(k))) return key;
  }
  return null;
}

export async function mockParsePaper(input: PaperInput): Promise<ParsePaperResult> {
  await sleep(Math.min(600, config.grading.mockLatencyMs * 4));
  const key = fixtureKeyForPaper(input);
  if (key) {
    const p = PAPER_BY_KEY[key];
    const paper: ParsedPaper = {
      title: p.title,
      questions: p.questions.map((q) => ({
        number: q.number,
        text: q.text,
        maxMarks: q.maxMarks,
        rubric: q.rubric,
        answerKey: q.answerKey,
        conceptIds: q.conceptIds,
      })),
      warnings: [],
    };
    return { paper, meta: { ...emptyMeta("mock"), calls: 1 } };
  }
  const conceptId = input.concepts[0]?.id ?? "";
  return {
    paper: {
      title: "Untitled paper",
      questions: [1, 2, 3].map((n) => ({
        number: n,
        text: `Question ${n} (edit the text — the mock AI cannot read this paper)`,
        maxMarks: 4,
        rubric: [
          { step: "Method", marks: 2 },
          { step: "Final answer", marks: 2 },
        ],
        answerKey: "",
        conceptIds: conceptId ? [conceptId] : [],
      })),
      warnings: ["Mock AI: this paper is not one of the bundled samples, so the questions below are placeholders. Edit them before grading."],
    },
    meta: { ...emptyMeta("mock"), calls: 1 },
  };
}

export async function mockReadSheetHeader(input: HeaderInput): Promise<HeaderResult> {
  const sheet = sheetForPageKey(input.pageKey);
  if (!sheet) return { isFirstPage: true, name: null, roll: null };
  const first = sheet.pageKeys[0] === input.pageKey;
  return first ? { isFirstPage: true, name: sheet.detected.name, roll: sheet.detected.roll } : { isFirstPage: false, name: null, roll: null };
}

function steps(rubric: { step: string; marks: number }[], awards: number[]) {
  return rubric.map((r, i) => ({ step: r.step, marks: r.marks, awarded: awards[i] ?? 0 }));
}

export async function mockGradeSheet(input: GradeSheetInput): Promise<GradeSheetResult> {
  await sleep(config.grading.mockLatencyMs);
  const sheet = input.sheetRef ? mockSheets().get(input.sheetRef) : undefined;
  const answers: AnswerResult[] = input.questions.map((q, i) => {
    const m = sheet?.answers.find((a) => a.questionNumber === q.number);
    if (m && m.passA.awards.length === q.rubric.length) {
      const passA: PassResult = {
        steps: steps(q.rubric, m.passA.awards),
        mistakeType: m.passA.mistakeType,
        misconception: m.passA.misconception,
        conceptIds: q.conceptIds,
        reasoning: m.passA.reasoning,
        keyAmbiguity: m.keyAmbiguity,
        selfConfidence: m.selfConfidence,
      };
      const passB: PassResult = {
        ...passA,
        steps: steps(q.rubric, m.passB.awards),
        mistakeType: m.passB.mistakeType,
        misconception: m.passB.misconception,
      };
      return {
        questionNumber: q.number,
        pageIndex: m.pageIndex,
        crop: m.crop,
        transcription: m.transcription,
        legibility: m.legibility,
        uncertainSpans: m.uncertainSpans,
        crossedOut: m.crossedOut,
        mixedLanguage: m.mixedLanguage,
        containsInstructions: m.injectionDetected,
        passA,
        passB,
      };
    }
    // Not in the fixtures: an honest placeholder that lands in the Low band for review.
    const half = q.rubric.map((r, k) => (k === 0 ? r.marks : 0));
    const passA: PassResult = {
      steps: steps(q.rubric, half),
      mistakeType: "incomplete",
      misconception: null,
      conceptIds: q.conceptIds,
      reasoning: "Mock AI: this sheet is not in the sample fixtures, so this is a placeholder grade. Please mark it yourself.",
      keyAmbiguity: 0.5,
      selfConfidence: 0.3,
    };
    const pages = Math.max(1, input.pageKeys.length);
    const per = Math.ceil(input.questions.length / pages);
    const pageIndex = Math.min(pages - 1, Math.floor(i / per));
    const slot = i % per;
    return {
      questionNumber: q.number,
      pageIndex,
      crop: { x: 0.04, y: 0.12 + (slot * 0.86) / per, w: 0.92, h: 0.86 / per },
      transcription: "[Mock AI] No transcription — this sheet is not part of the sample set.",
      legibility: 0.5,
      uncertainSpans: ["mock mode cannot read sheets outside the sample set"],
      crossedOut: false,
      mixedLanguage: false,
      containsInstructions: false,
      passA,
      passB: { ...passA, steps: steps(q.rubric, q.rubric.map(() => 0)) },
    };
  });
  return { answers, meta: { ...emptyMeta("mock"), calls: 1, latencyMs: config.grading.mockLatencyMs } };
}
