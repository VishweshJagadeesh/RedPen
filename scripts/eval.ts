/**
 * npm run eval [-- --mode mock|live] [-- --sheets N]
 * Writes evals/reports/<date>-<mode>.md and evals/reports/latest.json.
 */
import fs from "node:fs";
import path from "node:path";
import { aiMode } from "../lib/ai/mode";
import { runEvals, type EvalMode } from "../lib/evals/harness";
import { reportMarkdown, type ReviewAgreement } from "../lib/evals/report";
import type { GoldEntry } from "../lib/evals/gold";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const mode = (arg("mode") ?? aiMode()) as EvalMode;
  if (mode === "mock") process.env.MOCK_LATENCY_MS = process.env.MOCK_LATENCY_MS ?? "0";
  const goldDir = path.join(process.cwd(), "evals/gold");
  const gold: GoldEntry[] = fs
    .readdirSync(goldDir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(goldDir, f), "utf8")) as GoldEntry[]);
  console.log(`[eval] mode=${mode} gold=${gold.length} answers`);
  const report = await runEvals(gold, { mode, maxSheets: arg("sheets") ? Number(arg("sheets")) : undefined, log: (m) => console.log(`[eval] ${m}`) });

  let agreement: ReviewAgreement | null = null;
  try {
    const { reviewAgreement } = await import("../lib/evals/agreement");
    agreement = await reviewAgreement();
  } catch {
    console.log("[eval] database not available; skipping review-agreement section");
  }

  const outDir = path.join(process.cwd(), "evals/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const date = report.generatedAt.slice(0, 10);
  const md = path.join(outDir, `${date}-${mode}.md`);
  fs.writeFileSync(md, reportMarkdown(report, agreement));
  const { answers, ...summary } = report;
  fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify({ ...summary, answers: answers.filter((a) => a.ai !== a.gold || a.band !== "high" || a.tags.length > 1), agreement }, null, 2) + "\n");
  console.log(`[eval] exact ${report.grading.exactPct}% · ±1 ${report.grading.within1Pct}% · MAE ${report.grading.mae} · confidently wrong ${report.confidentlyWrong.count} · review load ${report.reviewLoad.reviewPct}%`);
  console.log(`[eval] flags P=${report.flags.precision.toFixed(2)} R=${report.flags.recall.toFixed(2)} · plan checks ${report.plan.checks.filter((c) => c.pass).length}/${report.plan.checks.length}`);
  console.log(`[eval] wrote ${path.relative(process.cwd(), md)} and evals/reports/latest.json`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
