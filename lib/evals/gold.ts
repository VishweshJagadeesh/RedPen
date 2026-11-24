/**
 * The eval gold set: teacher marks, concept and misconception for each answer image.
 * Built from the same fixtures that drew the sample sheets, then written to evals/gold/*.json.
 */
import type { Crop, MistakeType } from "../domain";
import { C8_EXIT_TICKET_TRANSPOSING, PAPER_BY_KEY, TRANSPOSING_REMEDIAL_BANK } from "../fixtures/papers";
import { mockSheets, type MockSheet } from "../fixtures/sheets";

export interface GoldEntry {
  id: string;
  sheetRef: string;
  paperKey: string;
  questionNumber: number;
  image: { pageKey: string; crop: Crop };
  maxMarks: number;
  goldMarks: number;
  goldSteps: number[];
  goldConcept: string;
  goldConceptIds: string[];
  goldMisconception: string | null;
  goldMistakeType: MistakeType;
  tags: string[];
}

function questionOf(sheet: MockSheet, n: number) {
  if (sheet.paperKey === "remedial-transposing") return TRANSPOSING_REMEDIAL_BANK[n - 1];
  const p = sheet.paperKey === C8_EXIT_TICKET_TRANSPOSING.key ? C8_EXIT_TICKET_TRANSPOSING : PAPER_BY_KEY[sheet.paperKey];
  return p.questions.find((q) => q.number === n)!;
}

function entriesFor(sheet: MockSheet): GoldEntry[] {
  return sheet.answers.map((a) => {
    const q = questionOf(sheet, a.questionNumber);
    const tags: string[] = [];
    if (a.gold.mistakeType === "unattempted") tags.push("blank");
    else if (a.gold.marks > 0 && a.gold.marks < q.maxMarks) tags.push("partial");
    if (a.crossedOut) tags.push("crossed_out", "messy");
    if (a.render.faint || a.legibility < 0.6) tags.push("messy");
    if (a.mixedLanguage) tags.push("hindi");
    if (a.render.diagram) tags.push("diagram");
    if (a.injectionDetected) tags.push("injection");
    return {
      id: `${sheet.sheetRef}:Q${a.questionNumber}`,
      sheetRef: sheet.sheetRef,
      paperKey: sheet.paperKey,
      questionNumber: a.questionNumber,
      image: { pageKey: sheet.pageKeys[a.pageIndex], crop: a.crop },
      maxMarks: q.maxMarks,
      goldMarks: a.gold.marks,
      goldSteps: a.gold.awards,
      goldConcept: q.conceptIds[0],
      goldConceptIds: q.conceptIds,
      goldMisconception: a.gold.misconception,
      goldMistakeType: a.gold.mistakeType,
      tags: [...new Set(tags)],
    };
  });
}

export function buildGoldSet(): Record<string, GoldEntry[]> {
  const sheets = [...mockSheets().values()];
  return {
    "wt4-8b": sheets.filter((s) => s.set === "8b-wt4").flatMap(entriesFor),
    robustness: sheets.filter((s) => s.set === "eval").flatMap(entriesFor),
  };
}
