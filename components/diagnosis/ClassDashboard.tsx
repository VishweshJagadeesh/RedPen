import Link from "next/link";
import { AlertTriangle, BellRing, BookOpen, CheckCircle2, ClipboardPlus, OctagonAlert, Printer, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareWorkButton } from "@/components/shared/ShareWorkButton";
import { ASSESSMENT_TYPE_LABEL, type AssessmentType } from "@/lib/domain";
import { assessmentStatus } from "@/lib/ui/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassTrendChart } from "@/components/charts/ClassTrendChart";
import { EmptyState } from "@/components/shared/States";
import { ClassConceptHeatmap } from "./ClassConceptHeatmap";
import { FlaggedStudentsList } from "./FlaggedStudentsList";
import { StudentRoster } from "./StudentRoster";
import { WeakConceptCard } from "./WeakConceptCard";
import type { SectionDashboardData } from "@/lib/queries/section";
import { formatDate } from "@/lib/format";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

const HEALTH = {
  healthy: { label: "Healthy", Icon: CheckCircle2, cls: "bg-high-bg text-high" },
  critical: { label: "Critical", Icon: AlertTriangle, cls: "bg-medium-bg text-[oklch(0.45_0.11_70)]" },
  poor: { label: "Poor", Icon: OctagonAlert, cls: "bg-low-bg text-low" },
};

function Kpi({ label, children, sub, tone, demoId, href }: { label: string; children: React.ReactNode; sub?: React.ReactNode; tone?: "low" | "medium" | "high"; demoId: string; href?: string }) {
  const body = (
    <div
      className={cn(
        "h-full rounded-xl border bg-card p-4",
        tone === "low" && "border-[oklch(0.85_0.08_27)] bg-low-bg/60",
        tone === "medium" && "border-[oklch(0.85_0.08_80)] bg-medium-bg/60",
        href && "hover:shadow-sm",
      )}
      data-demo-id={demoId}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    body
  );
}

/**
 * Class page. Order: headline numbers → class-wide weak concepts → trend and alerts (independent
 * heights) → homework → students and the concept heatmap in tabs.
 */
export function ClassDashboard({ data }: { data: SectionDashboardData }) {
  const sid = data.section.id;
  const k = data.kpis;
  const open = data.flags.filter((f) => f.status !== "resolved");
  const weak = data.weakConcepts.filter((c) => c.isWeak);
  const health = k.health ? HEALTH[k.health] : null;
  const studentHrefBase = `/sections/${sid}/students`;

  return (
    <div className="space-y-8" data-demo-id="class-dashboard">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Class at a glance">
        <Kpi label="Students" demoId="kpi-students" sub={`Class ${data.section.name} · ${data.section.academicYear}`}>
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" /> {data.studentCount}
          </span>
        </Kpi>
        <Kpi
          label={`Latest test${k.latestShort ? ` (${k.latestShort})` : ""}`}
          demoId="kpi-latest-average"
          tone={k.health === "poor" ? "low" : k.health === "critical" ? "medium" : undefined}
          sub={
            k.change !== null ? (
              <span className={cn(k.change <= -config.diagnosis.notableChange && "font-semibold text-low")}>
                {k.change < 0 ? <TrendingDown className="mr-1 inline h-3.5 w-3.5" /> : <TrendingUp className="mr-1 inline h-3.5 w-3.5" />}
                {k.change > 0 ? "+" : k.change < 0 ? "−" : ""}
                {Math.abs(k.change)} points vs {k.previousShort}
              </span>
            ) : undefined
          }
        >
          <span className="flex items-center gap-2">
            {k.latestAverage === null ? "—" : `${Math.round(k.latestAverage)}%`}
            {health && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", health.cls)}>
                <health.Icon className="h-3.5 w-3.5" /> {health.label}
              </span>
            )}
          </span>
        </Kpi>
        <Kpi label="Class-wide weak concepts" demoId="kpi-weak-concepts" tone={k.weakConcepts ? "low" : undefined} href="#weak-concepts" sub={k.weakConcepts ? "Open the cards below to act" : "None right now"}>
          <span className="flex items-center gap-2">
            {k.weakConcepts > 0 && <AlertTriangle className="h-5 w-5 text-low" />}
            {k.weakConcepts}
          </span>
        </Kpi>
        <Kpi label="Needs attention" demoId="kpi-open-flags" tone={k.openFlags ? "medium" : undefined} href="#needs-attention" sub="Open student alerts">
          <span className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-muted-foreground" /> {k.openFlags}
          </span>
        </Kpi>
        <Kpi
          label="Latest homework"
          demoId="kpi-homework"
          href="#homework"
          sub={k.latestHomework ? `${k.latestHomework.submitted}/${k.latestHomework.expected} submitted · ${k.latestHomework.title.replace(/ — .*/, "")}` : "No homework graded yet"}
        >
          {k.latestHomework ? `${Math.round(k.latestHomework.average)}%` : "—"}
        </Kpi>
      </section>

      <section id="weak-concepts" className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {weak.length > 0 && <AlertTriangle className="h-5 w-5 text-low" />}
            Class-wide weak concepts {weak.length > 0 && <span className="rounded-full bg-low px-2 text-sm text-white">{weak.length}</span>}
          </h2>
          <span className="text-xs text-muted-foreground">
            Weak when ≥{Math.round(config.diagnosis.classWeakShare * 100)}% of students scored under {config.diagnosis.weakScore}% in the latest test or homework that covered it
          </span>
        </div>
        {data.weakConcepts.length === 0 ? (
          <EmptyState title="No class-wide weak concepts" description="Individual students may still need help — see Students below and the alerts." />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {data.weakConcepts.map((c) => (
              <WeakConceptCard
                key={c.conceptId}
                concept={c}
                planHref={`/reteach/new?sectionId=${sid}&conceptId=${c.conceptId}`}
                practiceHref={`/remedial/new?sectionId=${sid}&conceptId=${c.conceptId}&group=weak`}
              />
            ))}
          </div>
        )}
      </section>

      {/* items-start: the chart card and the alerts card keep their own heights. */}
      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card data-demo-id="section-trend-card">
          <CardHeader className="pb-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Class average per test</CardTitle>
                <CardDescription>Weekly and periodic tests, finalised only. The scale zooms to the results so drops stand out.</CardDescription>
              </div>
              {health && k.latestAverage !== null && (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", health.cls)} data-demo-id="class-health">
                  <health.Icon className="h-4 w-4" /> {health.label}: {Math.round(k.latestAverage)}% in {k.latestShort}
                  {k.change !== null && ` (${k.change > 0 ? "+" : k.change < 0 ? "−" : ""}${Math.abs(k.change)})`}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.trend.length ? (
              <ClassTrendChart
                demoId="section-trend"
                data={data.trend.map((t) => ({ label: t.shortTitle, title: t.title, average: t.average }))}
                healthy={data.bands.healthy}
                critical={data.bands.critical}
                notable={data.bands.notable}
              />
            ) : (
              <EmptyState title="No finalised tests yet" />
            )}
          </CardContent>
        </Card>
        <Card id="needs-attention" className="scroll-mt-20" data-demo-id="needs-attention-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-4 w-4" /> Needs attention ({open.length})
              </CardTitle>
              <Link href="/alerts" className="text-xs text-primary hover:underline">
                All alerts
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Long lists scroll inside the card instead of stretching the row. */}
            <div className="max-h-[340px] overflow-y-auto pr-1">
              <FlaggedStudentsList flags={open} showSection={false} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="homework" className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" /> Homework: did the lesson land?
          </h2>
          <Button asChild size="sm" variant="outline" data-demo-id="grade-homework">
            <Link href={`/assessments/new?type=homework&sectionId=${sid}`}>
              <ClipboardPlus /> Grade a homework
            </Link>
          </Button>
        </div>
        {data.upcoming.length > 0 && (
          <div className="mb-4 rounded-xl border bg-card p-3" data-demo-id="class-upcoming">
            <div className="mb-2 text-sm font-medium">Set up on RedPen, waiting for sheets</div>
            <ul className="divide-y">
              {data.upcoming.map((u) => {
                const st = assessmentStatus({ status: "questions_ready", handedOut: u.handedOut, sheets: 0 });
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-demo-id={`upcoming-${u.id}`}>
                    <Link href={`/assessments/${u.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                      {u.title}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {ASSESSMENT_TYPE_LABEL[u.type as AssessmentType]} · {formatDate(u.date)}
                      </span>
                    </Link>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {st.tag && <Badge variant="outline">{st.tag}</Badge>}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/assessments/${u.id}/print`} target="_blank">
                        <Printer /> Print
                      </Link>
                    </Button>
                    <ShareWorkButton assessmentId={u.id} title={u.title} variant="ghost" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">▲ class-wide weak on this homework · ✓ fine · grey: only one short question, so not enough on its own</p>
        {data.homework.length === 0 ? (
          <EmptyState title="No homework graded yet" description="Homework goes through the same grading flow and feeds the weak-concept cards." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-demo-id="homework-list">
            {data.homework.slice(0, 3).map((h) => (
              <Link key={h.assessmentId} href={`/assessments/${h.assessmentId}/results`} className="rounded-xl border bg-card p-4 hover:shadow-sm" data-demo-id={`homework-${h.assessmentId}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(h.date)}</div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Average <span className="font-semibold text-foreground">{Math.round(h.average)}%</span> · {h.submitted}/{h.expected} submitted
                </div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {h.concepts.map((c) => {
                    const weakHere = c.enoughEvidence && c.shareUnder >= config.diagnosis.classWeakShare;
                    return (
                      <li key={c.id} className="flex items-start justify-between gap-2">
                        <span>{c.name}</span>
                        <span
                          className={cn(
                            "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                            !c.enoughEvidence ? "bg-muted text-muted-foreground" : weakHere ? "bg-low-bg text-low" : "bg-high-bg text-high",
                          )}
                          title={c.enoughEvidence ? `${c.marks} marks on this concept` : `Only ${c.marks} marks — too little to call the concept weak on its own`}
                        >
                          {!c.enoughEvidence ? "· " : weakHere ? "▲ " : "✓ "}
                          {Math.round(c.shareUnder * 100)}% under {config.diagnosis.weakScore}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students" data-demo-id="tab-students">
              Students ({data.studentCount})
            </TabsTrigger>
            <TabsTrigger value="heatmap" data-demo-id="tab-heatmap">
              Concept mastery
            </TabsTrigger>
          </TabsList>
          <TabsContent value="students">
            <StudentRoster rows={data.roster} seriesLabels={data.rosterLabels} weakConcepts={weak.map((w) => ({ id: w.conceptId, name: w.conceptName }))} studentHrefBase={studentHrefBase} />
          </TabsContent>
          <TabsContent value="heatmap">
            <ClassConceptHeatmap data={data.heatmap} studentHrefBase={studentHrefBase} weakConceptIds={weak.map((w) => w.conceptId)} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
