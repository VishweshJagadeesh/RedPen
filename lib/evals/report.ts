import type { EvalReport } from "./harness";

const yes = (b: boolean) => (b ? "✅ pass" : "❌ fail");

export interface ReviewAgreement {
  reviewed: number;
  overridden: number;
  overriddenPct: number;
  byBand: { band: string; reviewed: number; overridden: number; pct: number }[];
}

/** Dated markdown report written to evals/reports/. */
export function reportMarkdown(r: EvalReport, agreement: ReviewAgreement | null): string {
  const mockBanner =
    r.mode === "mock"
      ? `> **MOCK RESULTS.** These numbers come from deterministic fixture outputs and test the eval harness, not the model. Run with \`AI_MODE=live\` (and an API key) for real model numbers.\n\n`
      : "";
  const lines: string[] = [];
  lines.push(`# RedPen eval report — ${r.generatedAt.slice(0, 10)} (${r.mode.toUpperCase()})`, "", mockBanner);
  lines.push(`Grading model: \`${r.models.grading}\` · Planning model: \`${r.models.planning}\` · Gold answers: ${r.goldSize} · Sheets graded: ${r.sheets}`, "");
  lines.push("## Grading agreement (vs. teacher gold marks)", "");
  lines.push("| Metric | Value |", "|---|---|");
  lines.push(`| Exact match | ${r.grading.exactPct}% |`, `| Within ±1 mark | ${r.grading.within1Pct}% |`, `| Mean absolute error | ${r.grading.mae} marks |`, "");
  lines.push("<details><summary>Mean absolute error per question</summary>", "", "| Question | n | MAE | Exact |", "|---|---|---|---|");
  for (const q of r.grading.perQuestion) lines.push(`| ${q.key} | ${q.n} | ${q.mae} | ${q.exactPct}% |`);
  lines.push("", "</details>", "");
  lines.push("## Calibration", "", "| Band | Answers | Exact | Within ±1 | MAE |", "|---|---|---|---|---|");
  for (const c of r.calibration) lines.push(`| ${c.band} | ${c.n} | ${c.exactPct}% | ${c.within1Pct}% | ${c.mae} |`);
  lines.push("", `**Confidently wrong** (High band, off by more than 1 mark): **${r.confidentlyWrong.count}** (${r.confidentlyWrong.ratePct}% of High answers)${r.confidentlyWrong.ids.length ? ` — ${r.confidentlyWrong.ids.join(", ")}` : ""}.`, "");
  lines.push("## Review load", "", `${r.reviewLoad.reviewPct}% of answers go to the teacher for a closer look (Low ${r.reviewLoad.lowPct}%, Medium ${r.reviewLoad.mediumPct}%). High answers can be bulk-accepted.`, "");
  lines.push("## Tagging", "", `Concept-tag accuracy: **${r.tagging.conceptAccuracyPct}%**. Misconception-label agreement: **${r.tagging.misconceptionAgreementPct}%** (n = ${r.tagging.misconceptionN}).`, "");
  lines.push("## Robustness", "", "| Case | n | Exact | Within ±1 | Sent to Low/Medium | Expectation |", "|---|---|---|---|---|---|");
  for (const x of r.robustness) lines.push(`| ${x.label} | ${x.n} | ${x.exactPct}% | ${x.within1Pct}% | ${x.lowOrMediumPct}% | ${x.note} |`);
  lines.push(
    "",
    `**Injection sheets** (${r.injection.n}: ${r.injection.ids.join(", ")}): flagged ${yes(r.injection.allFlagged)} · Low band ${yes(r.injection.allLow)} · no credit for the instruction ${yes(r.injection.noCreditForInstruction)}.`,
    "",
  );
  lines.push("## Alerts: precision and recall on the seeded 8B cases", "");
  lines.push(`Expected: ${r.flags.expected.map((e) => `${e.student} (${e.type})`).join(", ")}.`, `Fired: ${r.flags.fired.map((e) => `${e.student} (${e.type})`).join(", ") || "none"}.`, "");
  lines.push(`Precision **${(r.flags.precision * 100).toFixed(0)}%** · Recall **${(r.flags.recall * 100).toFixed(0)}%** · Type matches ${r.flags.typeMatches}/${r.flags.expected.length} · False positives in 8B: ${r.flags.fp}. (Other sections, unconstrained: ${r.flags.otherSections.map((s) => `${s.section} ${s.flags}`).join(", ")}.)`, "");
  lines.push("## Reteach plan rubric (Transposing terms, 8B)", "", "| Check | Result | Detail |", "|---|---|---|");
  for (const c of r.plan.checks) lines.push(`| ${c.name} | ${yes(c.pass)} | ${c.detail.replace(/\|/g, "/")} |`);
  lines.push("", `Judge (${r.plan.judge.by === "ai" ? "AI judge" : "rule-based mock judge"}): overall ${(r.plan.judge.overall * 100).toFixed(0)}%.`);
  for (const [k, v] of Object.entries(r.plan.judge)) if (typeof v === "object" && v && "pass" in v) lines.push(`- ${k}: ${yes(v.pass)} — ${v.reason}`);
  lines.push("", "**Spot-check by hand** (tick after reading the plan below):", "", "- [ ] Every misconception step quotes this class's mistakes correctly", "- [ ] Timings are realistic for a 40-minute period", "- [ ] Exit ticket checks the objective", "- [ ] Nothing about students is invented", "");
  lines.push("<details><summary>Plan under review</summary>", "");
  for (const s of r.plan.sample) lines.push(`**${s.title}**${s.minutes ? ` (${s.minutes} min)` : ""}`, "", s.body.split("\n").map((l) => `> ${l}`).join("\n") || "> (questions only)", "");
  lines.push("</details>", "");
  lines.push("## Latency and cost per sheet", "", `Mean ${r.latency.perSheetMs} ms · p95 ${r.latency.p95SheetMs} ms · ${r.latency.costPerSheetUsd} USD per sheet (total ${r.latency.totalCostUsd} USD). ${r.latency.note}`, "");
  if (agreement) {
    lines.push("## Agreement from real teacher reviews (database)", "", `${agreement.overridden} of ${agreement.reviewed} reviewed answers were overridden (${agreement.overriddenPct}%).`, "", "| Band | Reviewed | Overridden | % |", "|---|---|---|---|");
    for (const b of agreement.byBand) lines.push(`| ${b.band} | ${b.reviewed} | ${b.overridden} | ${b.pct}% |`);
    lines.push("");
  }
  return lines.join("\n");
}
