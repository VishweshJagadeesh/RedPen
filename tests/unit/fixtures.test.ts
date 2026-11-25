import { describe, expect, it } from "vitest";
import { buildFixtures, toDataset, WT4_8B_ID } from "@/lib/fixtures/history";
import { PAPERS, variantsFor, TRANSPOSING_REMEDIAL_BANK } from "@/lib/fixtures/papers";
import { STUDENTS, SECTION_SIZES, studentsOf } from "@/lib/fixtures/school";
import { DatasetIndex } from "@/lib/diagnosis/dataset";
import { classConceptSummary, classWeakConcepts } from "@/lib/diagnosis/mastery";
import { simulateFlagHistory } from "@/lib/diagnosis/flags";
import { mockSheets } from "@/lib/fixtures/sheets";
import { bandFor } from "@/lib/grading/confidence";

const fx = buildFixtures();
const name8b = (id: string) => studentsOf("sec_8b").find((s) => s.id === id)!.name;

describe("roster", () => {
  it("has 152 students across 8A (48), 8B (52) and 9A (52)", () => {
    expect(STUDENTS).toHaveLength(152);
    expect(SECTION_SIZES).toEqual({ sec_8a: 48, sec_8b: 52, sec_9a: 52 });
    expect(new Set(STUDENTS.map((s) => s.shareToken)).size).toBe(152);
  });
});

describe("papers", () => {
  it("every variant awards per rubric step within the step's marks", () => {
    for (const p of PAPERS) {
      for (const q of p.questions) {
        for (const v of variantsFor(q)) {
          expect(v.awards, `${p.key} Q${q.number} ${v.id}`).toHaveLength(q.rubric.length);
          v.awards.forEach((a, i) => expect(a).toBeLessThanOrEqual(q.rubric[i].marks));
        }
      }
    }
    expect(TRANSPOSING_REMEDIAL_BANK).toHaveLength(10);
  });
});

describe("seeded stories for 8B", () => {
  const seeded = toDataset("sec_8b", fx.assessments.filter((a) => a.graded));

  it("(b) Transposing terms is class-wide weak: 33 of 52 under 50%, 21/8/4 misconceptions, mastery 36%", () => {
    const s = classConceptSummary(new DatasetIndex(seeded), "c8-le-transposing")!;
    expect(s.isWeak).toBe(true);
    expect(s.studentsAssessed).toBe(52);
    expect(s.studentsUnder).toBe(33);
    expect(Math.round(s.meanPct)).toBe(36);
    expect(s.misconceptions.map((m) => m.count)).toEqual([21, 8, 4]);
    expect(s.misconceptions[0].label).toMatch(/without changing its sign/);
    expect(s.snippets.length).toBeGreaterThanOrEqual(2);
  });

  it("(c) exactly three flags fire in 8B: Rohan, Sneha (sudden drop) and Imran (missed submissions)", () => {
    const flags = fx.flags.filter((f) => f.sectionId === "sec_8b");
    expect(flags.map((f) => [name8b(f.studentId), f.type]).sort()).toEqual([
      ["Imran Shaikh", "missed_submissions"],
      ["Rohan Kumar", "sudden_drop"],
      ["Sneha Iyer", "sudden_drop"],
    ]);
    const rohan = flags.find((f) => name8b(f.studentId) === "Rohan Kumar")!;
    expect(rohan.evidence.summary).toMatch(/76% fell to 41%/);
    expect(rohan.evidence.summary).toMatch(/Linear Equations/);
    expect(rohan.evidence.mistakeMix.find((m) => m.mistakeType === "unattempted")?.questions).toBe(2);
    const sneha = flags.find((f) => name8b(f.studentId) === "Sneha Iyer")!;
    expect(sneha.evidence.summary).toMatch(/82% fell to 55%/);
    expect(sneha.evidence.mistakeMix[0].mistakeType).toBe("calculation");
    const imran = flags.find((f) => name8b(f.studentId) === "Imran Shaikh")!;
    expect(imran.evidence.summary).toMatch(/Missed 2 of the last 4/);
  });

  it("grading WT4 does not create surprise flags or change the weak-concept story", () => {
    const all = toDataset("sec_8b", fx.assessments);
    const flagged = simulateFlagHistory(all).map((f) => name8b(f.studentId)).sort();
    expect(flagged).toEqual(["Imran Shaikh", "Rohan Kumar", "Sneha Iyer"]);
    const after = classConceptSummary(new DatasetIndex(all), "c8-le-transposing")!;
    expect(after.studentsUnder).toBe(33);
    expect(Math.round(after.meanPct)).toBe(36);
    // Two weak concepts from tests, plus one surfaced by homework before any test covered it.
    const weak = classWeakConcepts(new DatasetIndex(seeded));
    expect(weak.map((w) => w.conceptName)).toEqual(["Transposing terms", "Variables on both sides", "Percentage increase and decrease"]);
    const pct = weak.find((w) => w.conceptId === "c8-cq-percent")!;
    expect(pct.assessmentType).toBe("homework");
    expect(pct.misconceptions[0].label).toBe("Uses the new value as the base");
  });

  it("(a) WT4 mock grading yields 40 High, 9 Medium and 3 Low sheets", () => {
    const wt4 = fx.assessments.find((a) => a.id === WT4_8B_ID)!;
    expect(wt4.submissions).toHaveLength(52);
    const bands = { high: 0, medium: 0, low: 0 };
    for (const s of wt4.submissions) {
      const min = Math.min(...s.answers.map((a) => a.confidence));
      bands[bandFor(min)]++;
    }
    expect(bands).toEqual({ high: 40, medium: 9, low: 3 });
    const messy = mockSheets().get("8B-WT4-R25")!.answers.find((a) => a.questionNumber === 4)!;
    expect(messy.passA.awards.reduce((s, x) => s + x, 0)).toBe(2);
    expect(messy.gold.marks).toBe(3);
  });

  it("(d) the exit ticket averages 71% and (e) Rohan's remedial scores 8/10", () => {
    const total = fx.exitTicket8B.reduce((s, x) => s + x.answers.reduce((t, a) => t + a.finalMarks, 0), 0);
    expect(Math.round((total / (52 * 10)) * 100)).toBe(71);
    expect(fx.rohanRemedial.answers.reduce((t, a) => t + a.finalMarks, 0)).toBe(8);
  });
});
