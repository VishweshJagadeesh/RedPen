/** Chooses the live or mock implementation of every AI capability based on AI_MODE. */
import { aiMode } from "./mode";
import { liveGradeSheet, liveParsePaper, liveReadSheetHeader } from "./live";
import { mockGradeSheet, mockParsePaper, mockReadSheetHeader } from "./mock";
import type { GradeSheetInput, HeaderInput, PaperInput } from "./types";

export function ai() {
  const live = aiMode() === "live";
  return {
    mode: live ? ("live" as const) : ("mock" as const),
    parsePaper: (input: PaperInput) => (live ? liveParsePaper(input) : mockParsePaper(input)),
    readSheetHeader: (input: HeaderInput) => (live ? liveReadSheetHeader(input) : mockReadSheetHeader(input)),
    gradeSheet: (input: GradeSheetInput) => (live ? liveGradeSheet(input) : mockGradeSheet(input)),
  };
}

export { AiError } from "./client";
