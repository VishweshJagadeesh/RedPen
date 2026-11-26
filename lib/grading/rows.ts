/** Pure mapping from an AI grading result to stored grade rows (shared by the pipeline and the walkthrough). */
import { bandFor, computeConfidence, detectInjection } from "./confidence";
import type { ConfidenceBand, ConfidenceSignals } from "../domain";
import type { AnswerResult, QuestionForGrading } from "../ai/types";

/** A sheet takes the band of its least certain answer. */
export function sheetBand(confidences: number[]): ConfidenceBand {
  if (confidences.length === 0) return "high";
  return bandFor(Math.min(...confidences));
}

function marksOf(steps: { awarded: number }[]) {
  return steps.reduce((s, x) => s + x.awarded, 0);
}

/** Builds confidence signals for one answer from the two passes and the reading signals. */
export function signalsFor(answer: AnswerResult, maxMarks: number): ConfidenceSignals {
  const stepDisagreements: string[] = [];
  answer.passA.steps.forEach((s, i) => {
    const b = answer.passB.steps[i];
    if (b && b.awarded !== s.awarded) stepDisagreements.push(`step ${i + 1}: ${s.awarded} vs ${b.awarded}`);
  });
  return {
    passAMarks: marksOf(answer.passA.steps),
    passBMarks: marksOf(answer.passB.steps),
    maxMarks,
    legibility: answer.legibility,
    uncertainSpans: answer.uncertainSpans,
    keyAmbiguity: Math.max(answer.passA.keyAmbiguity, answer.passB.keyAmbiguity),
    selfConfidence: Math.min(answer.passA.selfConfidence, answer.passB.selfConfidence),
    // Never rely on the model alone: a pattern check on the transcription also flags instructions.
    injectionDetected: answer.containsInstructions || detectInjection(answer.transcription),
    crossedOut: answer.crossedOut,
    mixedLanguage: answer.mixedLanguage,
    stepDisagreements,
  };
}

/** The AnswerGrade row (JSON fields as strings) for one graded answer, before review. */
export function answerGradeRow(submissionId: string, q: QuestionForGrading, ans: AnswerResult) {
  const signals = signalsFor(ans, q.maxMarks);
  const conf = computeConfidence(signals);
  return {
    id: `ag_${submissionId}_${q.number}`,
    submissionId,
    questionId: q.id,
    pageIndex: ans.pageIndex,
    crop: JSON.stringify(ans.crop),
    transcription: ans.transcription,
    awardedMarks: marksOf(ans.passA.steps),
    maxMarks: q.maxMarks,
    steps: JSON.stringify(ans.passA.steps),
    mistakeType: ans.passA.mistakeType,
    misconception: ans.passA.misconception,
    aiReasoning:
      signals.injectionDetected && !/addressed to the grader/i.test(ans.passA.reasoning)
        ? `The answer contains text addressed to the grader; it was ignored. ${ans.passA.reasoning}`
        : ans.passA.reasoning,
    conceptIds: JSON.stringify(ans.passA.conceptIds.length ? ans.passA.conceptIds : q.conceptIds),
    confidence: conf.score,
    confidenceReasons: JSON.stringify(conf.reasons),
    signals: JSON.stringify(signals),
    passes: JSON.stringify([
      { pass: "A", marks: marksOf(ans.passA.steps), steps: ans.passA.steps, mistakeType: ans.passA.mistakeType, misconception: ans.passA.misconception },
      { pass: "B", marks: marksOf(ans.passB.steps), steps: ans.passB.steps, mistakeType: ans.passB.mistakeType, misconception: ans.passB.misconception },
    ]),
    status: "pending_review",
  };
}
