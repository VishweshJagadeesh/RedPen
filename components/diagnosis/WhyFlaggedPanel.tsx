"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, ClipboardList, Lightbulb, RotateCcw, Wrench } from "lucide-react";
import { assessmentHref, gradeActionLabel } from "@/lib/ui/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { HBarList } from "@/components/charts/TrendLineChart";
import { FLAG_STATUS_LABEL, FLAG_TYPE_LABEL, MISTAKE_LABEL, type FlagStatus, type FlagType } from "@/lib/domain";
import { formatDate, formatMarks } from "@/lib/format";
import type { FlagDetail } from "@/lib/queries/alerts";

export interface WhyFlaggedPanelProps {
  flag: FlagDetail;
  remedialHref: string;
  studentHref: string;
  busy: boolean;
  error: string | null;
  onSetStatus: (status: FlagStatus, note: string) => void;
}

/** Every flag explains itself: scores before and after, where marks were lost, which kind of mistakes, and what to do. */
export function WhyFlaggedPanel({ flag, remedialHref, studentHref, busy, error, onSetStatus }: WhyFlaggedPanelProps) {
  const e = flag.evidence;
  const [note, setNote] = useState("");
  if (!e) return <Alert tone="error">This alert has no evidence attached.</Alert>;
  const first = flag.student.name.split(" ")[0];
  return (
    <div className="space-y-5" data-demo-id="why-flagged-panel">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{FLAG_TYPE_LABEL[flag.type as FlagType]}</Badge>
            <Badge variant={flag.status === "resolved" ? "secondary" : flag.status === "improving" ? "high" : flag.status === "action_taken" ? "medium" : "low"} data-demo-id="flag-status">
              {FLAG_STATUS_LABEL[flag.status as FlagStatus]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Flagged {formatDate(flag.createdAt)} after {e.trigger.title}
            </span>
            <Link href={studentHref} className="ml-auto text-sm text-primary hover:underline">
              Student page
            </Link>
          </div>
          <p className="text-lg leading-snug" data-demo-id="flag-summary">
            {e.summary}
          </p>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Why it fired</div>
            <ul className="space-y-1 text-sm" data-demo-id="flag-rules">
              {e.rulesFired.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium">{r.rule}.</span> {r.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {e.scores && (
          <Card>
            <CardHeader>
              <CardTitle>Scores before and after</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3" data-demo-id="flag-scores">
              <div className="flex items-baseline gap-3">
                <div>
                  <div className="text-3xl font-semibold tabular-nums">{Math.round(e.scores.previousAverage)}%</div>
                  <div className="text-xs text-muted-foreground">average of {e.scores.previous.map((p) => p.shortTitle).join(", ")}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-3xl font-semibold tabular-nums text-low">{Math.round(e.scores.latest.pct)}%</div>
                  <div className="text-xs text-muted-foreground">{e.scores.latest.title}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {e.scores.previous.map((p) => (
                  <span key={p.id} className="rounded border px-2 py-0.5 tabular-nums">
                    {p.shortTitle} {Math.round(p.pct)}%
                  </span>
                ))}
                <span className="rounded border border-low/40 bg-low-bg px-2 py-0.5 tabular-nums">
                  {e.scores.latest.shortTitle} {Math.round(e.scores.latest.pct)}%
                </span>
              </div>
              {e.rank && (
                <p className="text-sm text-muted-foreground">
                  Rank: above the median in {e.rank.previousTitle} ({Math.round(e.rank.previousPct)}% vs {Math.round(e.rank.previousMedian)}%), below the 25th percentile now ({Math.round(e.rank.latestPct)}% vs {Math.round(e.rank.latestP25)}%).
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {e.missed && (
          <Card>
            <CardHeader>
              <CardTitle>Submissions in the last {e.missed.window.length} tests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm" data-demo-id="flag-missed">
                {e.missed.window.map((w) => (
                  <li key={w.id} className="flex items-center justify-between rounded border px-3 py-1.5">
                    <span>
                      {w.title} <span className="text-xs text-muted-foreground">{formatDate(w.date)}</span>
                    </span>
                    {w.submitted ? <Badge variant="high">Submitted</Badge> : <Badge variant="low">Missed</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>What kind of mistakes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-demo-id="flag-mistake-mix">
            <p className="text-sm font-medium">{e.mistakePattern}</p>
            {e.mistakeMix.length > 0 && (
              <HBarList items={e.mistakeMix.map((m) => ({ label: `${m.label} (${m.questions} question${m.questions === 1 ? "" : "s"})`, value: m.marksLost }))} unit=" marks lost" />
            )}
            <p className="text-xs text-muted-foreground">Unattempted questions and calculation slips call for different actions — the suggestion below follows the mix.</p>
          </CardContent>
        </Card>
      </div>

      {e.chapterBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where the marks were lost in {e.trigger.shortTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2" data-demo-id="flag-chapters">
              {e.chapterBreakdown.map((c) => (
                <div key={c.chapter} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{c.chapter}</div>
                  <div className="text-muted-foreground">
                    {formatMarks(c.got)}/{formatMarks(c.max)} ({c.pct}%){c.beforePct !== null ? ` · earlier ${c.beforePct}%` : " · first test on this chapter"} · {formatMarks(c.lost)} marks lost
                  </div>
                </div>
              ))}
            </div>
            <Table data-demo-id="flag-concepts">
              <THead>
                <tr>
                  <TH>Concept</TH>
                  <TH className="text-right">Before</TH>
                  <TH className="text-right">Now</TH>
                  <TH className="text-right">Marks lost</TH>
                </tr>
              </THead>
              <TBody>
                {e.conceptBreakdown.map((c) => (
                  <TR key={c.conceptId}>
                    <TD>{c.name}</TD>
                    <TD className="text-right tabular-nums">{c.beforePct === null ? "—" : `${c.beforePct}%`}</TD>
                    <TD className="text-right tabular-nums">{c.afterPct}%</TD>
                    <TD className="text-right tabular-nums">{formatMarks(c.marksLost)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Table data-demo-id="flag-questions">
              <THead>
                <tr>
                  <TH>Question</TH>
                  <TH>Marks</TH>
                  <TH>Mistake</TH>
                  <TH>What was written</TH>
                </tr>
              </THead>
              <TBody>
                {e.questionBreakdown.map((q) => (
                  <TR key={q.questionId}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/assessments/${q.assessmentId}/results`} className="hover:underline">
                        Q{q.number}
                      </Link>
                      <div className="text-xs text-muted-foreground">{q.concepts.join(", ")}</div>
                    </TD>
                    <TD className="tabular-nums">
                      {formatMarks(q.marks)}/{formatMarks(q.maxMarks)}
                    </TD>
                    <TD>
                      <div>{MISTAKE_LABEL[q.mistakeType]}</div>
                      {q.misconception && <div className="text-xs text-muted-foreground">{q.misconception}</div>}
                    </TD>
                    <TD className="max-w-[260px]">
                      <pre className="truncate whitespace-pre-wrap font-[family-name:var(--font-hand)] text-sm text-[#1d3b9c]">{q.transcription || "(blank)"}</pre>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {e.updates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Since then</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {e.updates.map((u) => (
                <li key={u.assessmentId}>
                  <span className="font-medium">{u.title}</span> ({formatDate(u.date)}): {u.summary}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" /> Suggested action
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p data-demo-id="flag-suggested-action">{e.suggestedAction}</p>
          <Textarea placeholder={`Note for ${first}'s record (optional)`} value={note} onChange={(ev) => setNote(ev.target.value)} data-demo-id="flag-note" />
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button asChild data-demo-id="create-remedial-from-flag">
              <Link href={remedialHref}>
                <ClipboardList /> Create a remedial sheet
              </Link>
            </Button>
            {flag.status === "open" && (
              <Button variant="outline" disabled={busy} onClick={() => onSetStatus("action_taken", note)} data-demo-id="mark-action-taken">
                <Wrench /> Mark action taken
              </Button>
            )}
            {flag.status !== "resolved" ? (
              <Button variant="outline" disabled={busy} onClick={() => onSetStatus("resolved", note)} data-demo-id="resolve-flag">
                <CheckCircle2 /> Resolve
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => onSetStatus("open", note)} data-demo-id="reopen-flag">
                <RotateCcw /> Reopen
              </Button>
            )}
          </div>
          {flag.remedials.length > 0 && (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {flag.remedials.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/remedial/${r.id}`} className="text-primary hover:underline">
                    {r.title}
                  </Link>
                  <span>· {r.status === "assigned" ? "awaiting answers" : r.status}</span>
                  {r.assessmentId && (
                    <Button asChild size="sm" variant={r.assessmentStatus === "final" ? "ghost" : "default"}>
                      <Link href={assessmentHref({ id: r.assessmentId, status: r.assessmentStatus ?? "" })} data-demo-id={`grade-remedial-${r.id}`}>
                        <ClipboardCheck /> {gradeActionLabel(r.assessmentStatus)}
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 border-l pl-4 text-sm" data-demo-id="flag-history">
            {flag.history.map((h, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{FLAG_STATUS_LABEL[h.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(h.at)}</span>
                </div>
                <p className="mt-0.5">{h.note}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
