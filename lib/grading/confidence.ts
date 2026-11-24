/**
 * Confidence scoring. We do not trust the model's self-report alone: the score combines whether two
 * independent grading passes agreed, handwriting legibility, transcription uncertainty and answer-key
 * ambiguity, and every penalty comes with a plain-language reason.
 */
import { config } from "../config";
import type { ConfidenceBand, ConfidenceSignals } from "../domain";

export interface ConfidenceResult {
  score: number;
  band: ConfidenceBand;
  reasons: string[];
}

function marks(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} mark${n === 1 ? "" : "s"}`;
}

export function bandFor(score: number, cfg = config.confidence): ConfidenceBand {
  if (score >= cfg.high) return "high";
  if (score >= cfg.medium) return "medium";
  return "low";
}

export function computeConfidence(s: ConfidenceSignals, cfg = config.confidence): ConfidenceResult {
  let score = 1;
  const reasons: string[] = [];

  const diff = Math.abs(s.passAMarks - s.passBMarks);
  if (diff === 0) {
    if (s.stepDisagreements && s.stepDisagreements.length > 0) {
      score *= 0.9;
      reasons.push(`Both passes gave ${marks(s.passAMarks)}, but split the steps differently (${s.stepDisagreements.join("; ")})`);
    }
  } else if (diff <= 0.5) {
    score *= 0.84;
    reasons.push(`The two grading passes disagreed by ${marks(diff)} (${s.passAMarks} vs ${s.passBMarks})`);
  } else if (diff <= 1) {
    score *= 0.7;
    reasons.push(`The two grading passes disagreed by ${marks(diff)} (${s.passAMarks} vs ${s.passBMarks})`);
  } else {
    score *= 0.5;
    reasons.push(`The two grading passes disagreed by ${marks(diff)} (${s.passAMarks} vs ${s.passBMarks})`);
  }

  if (s.legibility < 0.9) {
    score *= Math.max(0.3, 1 - (0.9 - s.legibility) * 1.5);
    const level = s.legibility < 0.6 ? "hard to read" : "partly unclear";
    reasons.push(`Handwriting is ${level} (legibility ${Math.round(s.legibility * 100)}%)`);
  }

  for (const span of s.uncertainSpans) {
    score *= 0.85;
    reasons.push(`Transcription uncertain: ${span}`);
  }

  if (s.keyAmbiguity > 0.05) {
    score *= 1 - 0.35 * Math.min(1, s.keyAmbiguity);
    reasons.push(
      s.keyAmbiguity >= 0.4
        ? "The answer uses a valid method the answer key does not show"
        : "The answer key is slightly ambiguous for this answer",
    );
  }

  if (s.crossedOut) {
    score *= 0.85;
    reasons.push("Crossed-out working near the answer");
  }

  if (s.mixedLanguage) {
    score *= 0.92;
    reasons.push("Answer mixes Hindi and English");
  }

  score *= 0.85 + 0.15 * Math.max(0, Math.min(1, s.selfConfidence));

  if (s.injectionDetected) {
    score = Math.min(score, cfg.injectionCap);
    reasons.unshift("Contains instructions to the grader — ignored and graded on its merits only");
  }

  score = Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
  const band = bandFor(score, cfg);
  if (reasons.length === 0) {
    reasons.push("Both grading passes agreed", "Handwriting clearly legible");
  }
  return { score, band, reasons };
}

export const BAND_LABEL: Record<ConfidenceBand, string> = { high: "High", medium: "Medium", low: "Low" };
export const BAND_ORDER: Record<ConfidenceBand, number> = { low: 0, medium: 1, high: 2 };

/** Phrases that suggest a student is trying to instruct the grader. Model output is also checked. */
const INJECTION_PATTERNS = [
  /ignore (the |all |any |previous )?(rubric|instructions|marking|scheme|answer key)/i,
  /give (me )?(full|maximum|all|10\/10|100%) marks/i,
  /(award|grant) (me )?(full|maximum|all) marks/i,
  /you (must|should) (give|award|mark)/i,
  /(system|assistant) prompt/i,
  /disregard (the )?(rubric|instructions)/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}
