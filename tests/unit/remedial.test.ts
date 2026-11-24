import { describe, expect, it } from "vitest";
import { citeMistake, type MistakeEvidence } from "@/lib/remedial/service";

const base: MistakeEvidence = {
  studentId: "stu_8b_36",
  conceptId: "c8-le-transposing",
  assessmentId: "asm_8b_wt4",
  assessmentTitle: "Weekly Test 4",
  date: "2026-10-27",
  questionNumber: 3,
  questionConcepts: ["c8-le-bothsides", "c8-le-transposing"],
  transcription: "4x − 2x = 13 + 5\n2x = 18\nx = 9",
  misconception: 'Moves a term across "=" without changing its sign',
  mistakeType: "conceptual",
  marks: 1,
  maxMarks: 4,
};

describe("citeMistake", () => {
  it("cites the original answer the way a teacher would", () => {
    expect(citeMistake(base, null)).toBe("In Weekly Test 4, Q3, you moved a term across the equals sign without changing its sign (you wrote 4x − 2x = 13 + 5).");
  });
  it("names blanks honestly", () => {
    expect(citeMistake({ ...base, transcription: "", mistakeType: "unattempted", misconception: null }, null)).toBe("In Weekly Test 4, Q3, you left this type of question blank.");
  });
  it("anonymises group sheets", () => {
    const text = citeMistake(base, { count: 21 });
    expect(text).toMatch(/21 students in the group/);
    expect(text).not.toMatch(/\byou\b/);
  });
});
