import Link from "next/link";
import { ArrowRight, BellRing, BookOpenCheck, ClipboardCheck, FilePen, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/States";
import { ASSESSMENT_TYPE_LABEL, FLAG_TYPE_LABEL, type AssessmentType, type FlagType } from "@/lib/domain";
import { formatDate, formatPct } from "@/lib/format";
import type { HomeData } from "@/lib/queries/home";

import { assessmentStatus, statusLabel } from "@/lib/ui/status";

export { statusLabel };

/** Teacher home: what needs doing today, then a card per section. */
export function TeacherHome({ data, teacherFirstName }: { data: HomeData; teacherFirstName: string }) {
  const weakAll = data.sections.flatMap((section) => section.weakConcepts.map((w) => ({ section, w }))).sort((a, b) => b.w.shareUnder - a.w.shareUnder);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {teacherFirstName}</h1>
        <p className="text-sm text-muted-foreground">Here is what needs you, and how each class is doing.</p>
      </div>

      {weakAll.length > 0 && (
        <a
          href="#class-wide-weak"
          role="alert"
          data-demo-id="weak-concepts-banner"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[oklch(0.85_0.08_27)] bg-low-bg px-4 py-3 text-sm hover:shadow-sm"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-low" />
          <span className="font-semibold text-low">
            {weakAll.length} class-wide weak concept{weakAll.length === 1 ? "" : "s"}
          </span>
          <span className="text-foreground">
            {data.sections
              .filter((s) => s.weakConcepts.length)
              .map((s) => `${s.name}: ${s.weakConcepts.map((w) => w.name).join(", ")}`)
              .join(" · ")}
          </span>
          <ArrowRight className="ml-auto h-4 w-4 text-low" />
        </a>
      )}

      {weakAll.length > 0 && (
        <section id="class-wide-weak" className="scroll-mt-20" data-demo-id="home-weak-concepts">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert className="h-5 w-5 text-low" /> Class-wide weak concepts
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {weakAll.map(({ section, w }) => (
              <div key={`${section.id}-${w.id}`} className="flex flex-col rounded-xl border border-[oklch(0.88_0.06_27)] bg-card p-4" data-demo-id={`home-weak-${section.name}-${w.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Class {section.name} · {w.chapter}
                    </div>
                    <div className="font-semibold">{w.name}</div>
                  </div>
                  <Badge variant="low">{Math.round(w.shareUnder * 100)}% under 50%</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {w.studentsUnder} of {w.studentsAssessed} students · class mastery {Math.round(w.meanPct)}% · {w.source === "homework" ? "spotted in " : ""}
                  {w.assessmentTitle}
                </div>
                {w.topMisconception && (
                  <div className="mt-1 text-sm">
                    Most common: <span className="font-medium">{w.topMisconception.label}</span> ({w.topMisconception.count})
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline" data-demo-id="home-weak-view-class">
                    <Link href={`/sections/${section.id}#weak-concepts`}>
                      <Users /> View class
                    </Link>
                  </Button>
                  <Button asChild size="sm" data-demo-id="home-weak-plan-reteach">
                    <Link href={w.plan ? `/reteach/${w.plan.id}` : `/reteach/new?sectionId=${section.id}&conceptId=${w.id}`}>
                      <BookOpenCheck /> {w.plan ? "Open reteach plan" : "Plan a reteach"}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.drafts.length > 0 && (
        <section data-demo-id="home-drafts">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FilePen className="h-4 w-4" /> Drafts to finish
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.drafts.map((d) => (
              <Link key={d.id} href={d.href} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:shadow-sm" data-demo-id={`draft-${d.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.kind} · Class {d.section} · {formatDate(d.at)}
                  </div>
                </div>
                <Badge variant="secondary">{d.saved ? "Saved draft" : "Draft"}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> To grade and review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.toDo.length === 0 && <EmptyState title="Nothing waiting" description="Create an assessment to upload a new set of answer sheets." />}
            {data.toDo.map((a) => {
              const st = assessmentStatus(a);
              return (
                <Link
                  key={a.id}
                  href={a.status === "in_review" ? `/assessments/${a.id}/review` : a.status === "grading" ? `/assessments/${a.id}/grade` : `/assessments/${a.id}`}
                  data-demo-id={`todo-${a.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.section} · {ASSESSMENT_TYPE_LABEL[a.type as AssessmentType]} · {formatDate(a.date)} · {st.tag ? "print or share it from here" : `${a.sheets} sheets`}
                      {a.pendingReview ? ` · ${a.pendingReview} to review` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {st.tag && <Badge variant="outline">{st.tag}</Badge>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4" /> Needs attention
            </CardTitle>
            <CardDescription>Every alert says why it fired.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-3 overflow-y-auto">
            {data.flags.length === 0 && <EmptyState title="No open alerts" />}
            {data.flags.map((f) => (
              <Link key={f.id} href={`/alerts/${f.id}`} data-demo-id={`home-flag-${f.id}`} className="block rounded-lg border p-3 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{f.studentName}</span>
                  <span className="text-xs text-muted-foreground">{f.section}</span>
                  <Badge variant="outline" className="ml-auto">{FLAG_TYPE_LABEL[f.type as FlagType]}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.summary}</p>
              </Link>
            ))}
            <Button asChild variant="ghost" size="sm">
              <Link href="/alerts">See all alerts</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your classes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {data.sections.map((s) => (
            <Link key={s.id} href={`/sections/${s.id}`} data-demo-id={`section-card-${s.name}`} className="rounded-xl border bg-card p-5 hover:shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-semibold">Class {s.name}</div>
                <div className="text-sm text-muted-foreground">{s.students} students</div>
              </div>
              <div className="mt-3 text-sm">
                Latest average{s.latestTitle ? ` (${s.latestTitle})` : ""}: <span className="font-semibold">{formatPct(s.latestAverage)}</span>
                {s.change !== null && (
                  <span className={s.change <= -5 ? "ml-2 font-semibold text-low" : "ml-2 text-muted-foreground"}>
                    {s.change < 0 ? "▼" : "▲"} {Math.abs(s.change)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.weakConcepts.length > 0 ? (
                  <Badge variant="low" data-demo-id={`section-card-weak-${s.name}`}>
                    <TriangleAlert /> {s.weakConcepts.length} weak concept{s.weakConcepts.length === 1 ? "" : "s"}
                  </Badge>
                ) : (
                  <Badge variant="high">No class-wide weak concepts</Badge>
                )}
                {s.openFlags > 0 && <Badge variant="outline">{s.openFlags} alert{s.openFlags === 1 ? "" : "s"}</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
