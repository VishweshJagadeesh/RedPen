import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import type { EvalReport } from "@/lib/evals/harness";
import type { ReviewAgreement } from "@/lib/evals/report";
import { formatDate } from "@/lib/format";

export type EvalSummary = Omit<EvalReport, "answers"> & { answers: EvalReport["answers"] };

function Stat({ label, value, hint, demoId }: { label: string; value: string; hint?: string; demoId?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-demo-id={demoId}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const ok = (b: boolean) => (b ? <Badge variant="high">pass</Badge> : <Badge variant="low">fail</Badge>);

/** The eval report: agreement, calibration, review load, tagging, robustness, alerts, plan rubric, latency/cost. */
export function EvalReportView({ report, agreement }: { report: EvalSummary; agreement: ReviewAgreement | null }) {
  const r = report;
  return (
    <div className="space-y-6" data-demo-id="eval-report">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={r.mode === "mock" ? "medium" : "high"} data-demo-id="eval-mode">
          {r.mode === "mock" ? "MOCK results — tests the harness, not the model" : "LIVE model results"}
        </Badge>
        <span className="text-muted-foreground">
          {formatDate(r.generatedAt)} · grading: {r.models.grading} · planning: {r.models.planning} · {r.goldSize} gold answers on {r.sheets} sheets
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Exact match" value={`${r.grading.exactPct}%`} hint={`±1 mark: ${r.grading.within1Pct}% · MAE ${r.grading.mae}`} demoId="eval-exact" />
        <Stat label="Confidently wrong" value={String(r.confidentlyWrong.count)} hint={`High band answers off by >1 mark (${r.confidentlyWrong.ratePct}%)`} demoId="eval-confidently-wrong" />
        <Stat label="Review load" value={`${r.reviewLoad.reviewPct}%`} hint={`Low ${r.reviewLoad.lowPct}% · Medium ${r.reviewLoad.mediumPct}%`} demoId="eval-review-load" />
        <Stat label="Alert precision / recall" value={`${Math.round(r.flags.precision * 100)}% / ${Math.round(r.flags.recall * 100)}%`} hint={`${r.flags.typeMatches}/${r.flags.expected.length} seeded alerts fired with the right type; ${r.flags.fp} false positives in 8B`} demoId="eval-flags" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calibration</CardTitle>
            <CardDescription>Accuracy should rise with confidence; High answers must almost never be wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <tr>
                  <TH>Band</TH>
                  <TH className="text-right">Answers</TH>
                  <TH className="text-right">Exact</TH>
                  <TH className="text-right">±1</TH>
                  <TH className="text-right">MAE</TH>
                </tr>
              </THead>
              <TBody>
                {r.calibration.map((c) => (
                  <TR key={c.band}>
                    <TD>
                      <ConfidenceBadge band={c.band} showScore={false} />
                    </TD>
                    <TD className="text-right tabular-nums">{c.n}</TD>
                    <TD className="text-right tabular-nums">{c.exactPct}%</TD>
                    <TD className="text-right tabular-nums">{c.within1Pct}%</TD>
                    <TD className="text-right tabular-nums">{c.mae}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="mt-3 text-sm text-muted-foreground">
              Concept-tag accuracy {r.tagging.conceptAccuracyPct}% · misconception-label agreement {r.tagging.misconceptionAgreementPct}% (n = {r.tagging.misconceptionN}).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Robustness</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <tr>
                  <TH>Case</TH>
                  <TH className="text-right">n</TH>
                  <TH className="text-right">Exact</TH>
                  <TH className="text-right">To review</TH>
                </tr>
              </THead>
              <TBody>
                {r.robustness.map((x) => (
                  <TR key={x.tag}>
                    <TD title={x.note}>{x.label}</TD>
                    <TD className="text-right tabular-nums">{x.n}</TD>
                    <TD className="text-right tabular-nums">{x.exactPct}%</TD>
                    <TD className="text-right tabular-nums">{x.lowOrMediumPct}%</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-demo-id="eval-injection">
              Injection sheets ({r.injection.n}): flagged {ok(r.injection.allFlagged)} Low band {ok(r.injection.allLow)} no credit for the instruction {ok(r.injection.noCreditForInstruction)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reteach plan rubric</CardTitle>
            <CardDescription>{r.plan.judge.by === "ai" ? "AI judge with a written rubric" : "Rule checks (mock judge)"} · plus a spot-check by hand in the markdown report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" data-demo-id="eval-plan">
            {r.plan.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-2">
                {ok(c.pass)}
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted-foreground">{c.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latency and cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-2xl font-semibold tabular-nums">{(r.latency.perSheetMs / 1000).toFixed(2)} s / sheet</div>
            <div className="text-muted-foreground">
              p95 {(r.latency.p95SheetMs / 1000).toFixed(2)} s · ${r.latency.costPerSheetUsd} per sheet
            </div>
            <p className="text-muted-foreground">{r.latency.note}</p>
            {agreement && (
              <div className="border-t pt-3" data-demo-id="eval-agreement">
                <div className="font-medium">Agreement from teacher reviews (live data)</div>
                <div className="text-muted-foreground">
                  {agreement.overridden} of {agreement.reviewed} reviewed answers overridden ({agreement.overriddenPct}%): {agreement.byBand.map((b) => `${b.band} ${b.pct}%`).join(" · ")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {r.answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Answers that disagreed with the teacher or went to review</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <tr>
                  <TH>Answer</TH>
                  <TH>Band</TH>
                  <TH className="text-right">AI</TH>
                  <TH className="text-right">Teacher</TH>
                  <TH>Why</TH>
                </tr>
              </THead>
              <TBody>
                {r.answers.slice(0, 40).map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">{a.id}</TD>
                    <TD>
                      <ConfidenceBadge band={a.band} score={a.confidence} />
                    </TD>
                    <TD className="text-right tabular-nums">{a.ai}</TD>
                    <TD className="text-right tabular-nums">{a.gold}</TD>
                    <TD className="text-xs text-muted-foreground">{a.reasons.join("; ")}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
