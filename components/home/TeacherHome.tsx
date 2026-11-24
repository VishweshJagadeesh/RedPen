import Link from "next/link";
import { ArrowRight, BellRing, ClipboardCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/States";
import { ASSESSMENT_TYPE_LABEL, FLAG_TYPE_LABEL, type AssessmentType, type FlagType } from "@/lib/domain";
import { formatDate, formatPct } from "@/lib/format";
import type { HomeData } from "@/lib/queries/home";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  questions_ready: "Questions confirmed",
  sheets_uploaded: "Ready to grade",
  grading: "Grading",
  in_review: "In review",
  final: "Final",
};

export function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

/** Teacher home: what needs doing today, then a card per section. */
export function TeacherHome({ data, teacherFirstName }: { data: HomeData; teacherFirstName: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {teacherFirstName}</h1>
        <p className="text-sm text-muted-foreground">Here is what needs you, and how each class is doing.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> To grade and review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.toDo.length === 0 && <EmptyState title="Nothing waiting" description="Create an assessment to upload a new set of answer sheets." />}
            {data.toDo.map((a) => (
              <Link
                key={a.id}
                href={a.status === "in_review" ? `/assessments/${a.id}/review` : a.status === "grading" ? `/assessments/${a.id}/grade` : `/assessments/${a.id}`}
                data-demo-id={`todo-${a.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.section} · {ASSESSMENT_TYPE_LABEL[a.type as AssessmentType]} · {formatDate(a.date)} · {a.sheets} sheets
                    {a.pendingReview ? ` · ${a.pendingReview} to review` : ""}
                  </div>
                </div>
                <Badge variant={a.status === "sheets_uploaded" ? "default" : "secondary"}>{statusLabel(a.status)}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4" /> Needs attention
            </CardTitle>
            <CardDescription>Every alert says why it fired.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.weakConcepts.length > 0 ? (
                  s.weakConcepts.map((w) => (
                    <Badge key={w.id} variant="low">
                      <TriangleAlert /> {w.name}
                    </Badge>
                  ))
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
