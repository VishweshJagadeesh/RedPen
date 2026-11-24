import { describe, expect, it } from "vitest";
import type { Fact, StudentFacts } from "@/lib/ptm/facts";
import { templateSummary, validateSummary } from "@/lib/ptm/summary";

const facts: Fact[] = [
  { id: "score:pt1", kind: "score", text: "Rohan scored 16.5/40 (41%) in Periodic Test 1", source: { assessmentId: "pt1", label: "PT1" }, data: { pct: 41, classAvg: 57, title: "Periodic Test 1" } },
  { id: "strength:sq", kind: "strength", text: "Square root by prime factorisation: 80%.", source: { assessmentId: "pt1", label: "PT1" }, data: { concept: "Square root by prime factorisation", pct: 80 } },
  {
    id: "focus:tr",
    kind: "focus",
    text: "Transposing terms: 20%",
    source: { assessmentId: "pt1", label: "PT1 Q7", questionNumber: 7 },
    data: { concept: "Transposing terms", pct: 20, misconception: 'Moves a term across "=" without changing its sign', blank: false },
  },
  { id: "flag:1", kind: "flag", text: "Average of 76% fell to 41%", source: { assessmentId: "pt1", label: "PT1" }, data: { type: "sudden_drop", prevAvg: 76, latestPct: 41, trigger: "PT1" } },
];
const sf: StudentFacts = {
  student: { id: "s", name: "Rohan Kumar", firstName: "Rohan", rollNumber: 36, section: "8B", sectionId: "sec_8b" },
  facts,
  trend: [],
  strengths: [facts[1]],
  focus: [facts[2]],
  term: [facts[3]],
  pending: [],
};

describe("PTM summary", () => {
  const s = templateSummary(sf);
  it("cites only real facts, in English and Hindi, with exactly 3 talking points", () => {
    expect(validateSummary(s, facts)).toEqual([]);
    expect(s.talkingPoints).toHaveLength(3);
    for (const list of [s.strengths, s.focusAreas, s.termStory, s.talkingPoints]) for (const st of list) {
      expect(st.en.length).toBeGreaterThan(5);
      expect(st.hi).toMatch(/[ऀ-ॿ]/);
    }
  });
  it("turns the misconception into plain language and a concrete home activity", () => {
    expect(s.focusAreas[0].en).toMatch(/sign should change/);
    expect(s.talkingPoints[2].en).toMatch(/At home/);
    expect(s.termStory[0].en).toBe("Scores dropped from an average of 76% to 41% in PT1.");
  });
  it("rejects statements that cite facts not in the data", () => {
    expect(validateSummary({ ...s, strengths: [{ en: "x", hi: "x", factIds: ["made-up"] }] }, facts)[0]).toMatch(/unknown facts/);
  });
});
