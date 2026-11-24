import { describe, expect, it } from "vitest";

describe("eval harness (mock)", () => {
  it("runs end to end: calibrated, no confidently-wrong answers, seeded alerts exact, plan passes the rubric", async () => {
    process.env.MOCK_LATENCY_MS = "0";
    const { buildGoldSet } = await import("@/lib/evals/gold");
    const { runEvals } = await import("@/lib/evals/harness");
    const gold = Object.values(buildGoldSet()).flat();
    expect(gold.length).toBe(266);
    const r = await runEvals(gold, { mode: "mock" });
    expect(r.mode).toBe("mock");
    expect(r.confidentlyWrong.count).toBe(0);
    expect(r.grading.within1Pct).toBe(100);
    expect(r.flags.precision).toBe(1);
    expect(r.flags.recall).toBe(1);
    expect(r.injection.allFlagged && r.injection.allLow && r.injection.noCreditForInstruction).toBe(true);
    expect(r.plan.checks.every((c) => c.pass)).toBe(true);
    const high = r.calibration.find((c) => c.band === "high")!;
    const low = r.calibration.find((c) => c.band === "low")!;
    expect(high.exactPct).toBeGreaterThanOrEqual(low.exactPct);
  });
});
