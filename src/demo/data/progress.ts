/** Grading progress after `gradedCount` sheets, as the progress screen shows it (mirrors getGradingProgress). */
import type { GradingProgressView } from "@/components/grading/GradingProgress";
import type { GradedSheetStep } from "./types";

export function progressOf(order: GradedSheetStep[], gradedCount: number, totalSheets: number, questionsPerSheet: number): GradingProgressView {
  const graded = order.slice(0, gradedCount);
  const bands = { high: 0, medium: 0, low: 0 };
  const sheetBands = { high: 0, medium: 0, low: 0 };
  for (const s of graded) {
    for (const b of s.answerBands) bands[b]++;
    sheetBands[s.band]++;
  }
  return {
    totalSheets,
    gradedSheets: graded.length,
    totalAnswers: totalSheets * questionsPerSheet,
    answersGraded: graded.length * questionsPerSheet,
    bands,
    sheetBands,
    recent: [...graded].reverse().slice(0, 8).map((s) => ({ submissionId: s.submissionId, studentName: s.studentName, band: s.band, marks: s.marks, maxMarks: s.maxMarks })),
    errorSheets: [],
    done: graded.length === totalSheets,
  };
}
