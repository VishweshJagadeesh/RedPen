import { describe, expect, it } from "vitest";
import { buildFixtures, toDataset } from "@/lib/fixtures/history";
import { DatasetIndex } from "@/lib/diagnosis/dataset";
import { classHealth, classRoster, conceptHeatmap, homeworkSummaries, sectionTrend } from "@/lib/diagnosis/mastery";
import { evaluateSection } from "@/lib/diagnosis/flags";

const fx = buildFixtures();
const idx = new DatasetIndex(toDataset("sec_8b", fx.assessments.filter((a) => a.graded)));

describe("class insights", () => {
  it("health bands: ≥60 healthy, ≥45 critical, below poor", () => {
    expect(classHealth(64)).toBe("healthy");
    expect(classHealth(57)).toBe("critical");
    expect(classHealth(44)).toBe("poor");
    expect(classHealth(null)).toBeNull();
  });

  it("the class trend uses tests only and shows the PT1 drop into the critical band", () => {
    const t = sectionTrend(idx);
    expect(t.map((x) => x.shortTitle)).toEqual(["WT1", "WT2", "WT3", "PT1"]);
    expect(classHealth(t.at(-1)!.average)).toBe("critical");
    expect(t.at(-2)!.average - t.at(-1)!.average).toBeGreaterThanOrEqual(10);
  });

  it("homework is summarised with completion and per-concept understanding, newest first", () => {
    const hw = homeworkSummaries(idx);
    expect(hw.map((h) => h.shortTitle)).toEqual(["HW3", "HW2", "HW1"]);
    expect(hw[0].submitted).toBeLessThanOrEqual(hw[0].expected);
    const pct = hw[0].concepts.find((c) => c.id === "c8-cq-percent")!;
    expect(pct.enoughEvidence).toBe(true);
    expect(pct.shareUnder).toBeGreaterThanOrEqual(0.4);
  });

  it("homework never triggers test alerts", () => {
    const names = evaluateSection(toDataset("sec_8b", fx.assessments.filter((a) => a.graded && a.type !== "homework")))
      .map((r) => r.studentId)
      .sort();
    const withHw = evaluateSection(toDataset("sec_8b", fx.assessments.filter((a) => a.graded)))
      .map((r) => r.studentId)
      .sort();
    expect(withHw).toEqual(names);
  });

  it("the roster gives every student a searchable row with latest score, change and weakest concept", () => {
    const rows = classRoster(idx, ["c8-le-transposing"]);
    expect(rows).toHaveLength(52);
    const rohan = rows.find((r) => r.name === "Rohan Kumar")!;
    expect(rohan.latestPct).toBe(41);
    expect(rohan.change).toBeLessThanOrEqual(-30);
    expect(rohan.weakOnClassConcepts).toContain("c8-le-transposing");
    expect(rohan.homework.total).toBe(3);
  });

  it("heatmap columns carry short labels and chapters", () => {
    const h = conceptHeatmap(idx);
    const tr = h.concepts.find((c) => c.id === "c8-le-transposing")!;
    expect(tr.shortName).toBe("Transposing terms");
    expect(tr.chapter).toBe("Linear Equations in One Variable");
  });
});
