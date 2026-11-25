import Link from "next/link";
import { ClipboardList, ExternalLink, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { EmptyState } from "@/components/shared/States";
import { masteryColor } from "@/lib/ui/mastery-color";
import { ASSESSMENT_TYPE_LABEL, FLAG_STATUS_LABEL, FLAG_TYPE_LABEL, type AssessmentType, type FlagStatus, type FlagType } from "@/lib/domain";
import { formatDate, formatMarks, formatPct } from "@/lib/format";
import type { StudentViewData } from "@/lib/queries/student";

/** Teacher's view of one student: mastery over time, tests, alerts and actions taken. */
export function StudentDetail({ data, shareUrl }: { data: StudentViewData; shareUrl: string }) {
  const s = data.student;
  const pending = data.remedials.filter((r) => r.status === "assigned");
  return (
    <div className="space-y-6" data-demo-id="student-detail">
      <div className="flex flex-wrap gap-2">
        <Button asChild data-demo-id="open-ptm">
          <Link href={`/students/${s.id}/ptm`}>
            <Presentation /> PTM mode
          </Link>
        </Button>
        <Button asChild variant="outline" data-demo-id="open-parent-profile">
          <a href={shareUrl} target="_blank">
            <ExternalLink /> Parent profile link
          </a>
        </Button>
        <Button asChild variant="outline" data-demo-id="new-remedial-for-student">
          <Link href={`/remedial/new?sectionId=${s.sectionId}&studentIds=${s.id}`}>
            <ClipboardList /> Remedial sheet
          </Link>
        </Button>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          Parent: {s.parentName} · {s.parentPhone} <span className="italic">(teacher-only)</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Scores over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart demoId="student-trend" seriesName={s.name} compareName={`Class ${s.section} average`} data={data.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alerts and actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.flags.length === 0 && pending.length === 0 && data.remedials.length === 0 && <p className="text-muted-foreground">No alerts or actions this term.</p>}
            {data.flags.map((f) => (
              <Link key={f.id} href={`/alerts/${f.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{FLAG_TYPE_LABEL[f.type as FlagType]}</Badge>
                  <Badge variant="secondary">{FLAG_STATUS_LABEL[f.status as FlagStatus]}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{f.summary}</p>
                {f.history.length > 1 && <p className="mt-1 text-xs">Latest: {f.history.at(-1)?.note}</p>}
              </Link>
            ))}
            {data.remedials.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                  <Badge variant={r.status === "graded" ? "high" : "medium"}>{r.status === "assigned" ? "Pending" : r.status === "graded" ? "Graded" : "Draft"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.questions} questions{r.score ? ` · scored ${formatMarks(r.score.got)}/${formatMarks(r.score.max)}` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Concept mastery over time</CardTitle>
          <CardDescription>Weakest first. Each cell is the score on that concept in one test.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.concepts.length === 0 ? (
            <EmptyState title="No graded work yet" />
          ) : (
            <Table data-demo-id="student-concepts">
              <THead>
                <tr>
                  <TH>Concept</TH>
                  <TH>Now</TH>
                  <TH>Over time</TH>
                </tr>
              </THead>
              <TBody>
                {data.concepts.map((c) => {
                  const col = masteryColor(c.current ?? 0);
                  return (
                    <TR key={c.id}>
                      <TD>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.chapter}</div>
                      </TD>
                      <TD>
                        <span className="rounded px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ background: col.bg, color: col.fg }}>
                          {c.current}%
                        </span>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {c.timeline.map((t) => (
                            <span key={t.assessmentId} className="rounded border px-1.5 py-0.5 text-xs tabular-nums" title={`${t.title}: ${formatMarks(t.got)}/${formatMarks(t.max)}`}>
                              {t.label} {t.pct}%
                            </span>
                          ))}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>Assessment</TH>
                <TH>Type</TH>
                <TH>Date</TH>
                <TH className="text-right">Score</TH>
              </tr>
            </THead>
            <TBody>
              {data.assessments.map((a) => (
                <TR key={a.assessmentId}>
                  <TD>
                    <Link href={`/assessments/${a.assessmentId}/results`} className="hover:underline">
                      {a.title}
                    </Link>
                  </TD>
                  <TD>{ASSESSMENT_TYPE_LABEL[a.type as AssessmentType]}</TD>
                  <TD>{formatDate(a.date)}</TD>
                  <TD className="text-right tabular-nums">{a.pct === null ? <span className="italic text-muted-foreground">Absent</span> : `${formatMarks(a.got)}/${formatMarks(a.max)} · ${formatPct(a.pct)}`}</TD>
                </TR>
              ))}
              {pending.map((r) => (
                <TR key={r.id}>
                  <TD>{r.title}</TD>
                  <TD>Remedial</TD>
                  <TD>{formatDate(r.createdAt)}</TD>
                  <TD className="text-right">
                    <Badge variant="medium">Pending</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
