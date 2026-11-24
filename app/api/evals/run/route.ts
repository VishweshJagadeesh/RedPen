import { handle } from "@/lib/api";
import { buildGoldSet } from "@/lib/evals/gold";
import { runEvals } from "@/lib/evals/harness";

export const maxDuration = 120;

/** Runs the eval harness in mock mode on demand (fast, free). Live evals run from the CLI: npm run eval. */
export const POST = handle(async () => {
  process.env.MOCK_LATENCY_MS = "0";
  const gold = Object.values(buildGoldSet()).flat();
  const report = await runEvals(gold, { mode: "mock" });
  const { answers, ...rest } = report;
  return { ...rest, answers: answers.filter((a) => a.ai !== a.gold || a.band !== "high") };
});
