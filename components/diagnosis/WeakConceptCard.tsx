import Link from "next/link";
import { ArrowRight, BookOpenCheck, ClipboardList, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HBarList } from "@/components/charts/TrendLineChart";
import { formatDate } from "@/lib/format";
import type { WeakConceptView } from "@/lib/queries/section";

export interface WeakConceptCardProps {
  concept: WeakConceptView;
  planHref: string;
  practiceHref: string;
}

/** A class-wide weak concept: who is affected, which mistakes, real (anonymised) examples, and what to do. */
export function WeakConceptCard({ concept: c, planHref, practiceHref }: WeakConceptCardProps) {
  const pct = Math.round(c.shareUnder * 100);
  const plan = c.plan;
  return (
    <Card className="flex flex-col" data-demo-id={`weak-concept-card-${c.conceptId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">{c.chapter}</div>
            <CardTitle className="text-lg">{c.conceptName}</CardTitle>
          </div>
          {c.isWeak ? <Badge variant="low">Class-wide weak</Badge> : <Badge variant="high">No longer class-wide weak</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div data-demo-id="weak-concept-affected">
            <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
            <span className="ml-1 text-sm text-muted-foreground">
              of students under 50% ({c.studentsUnder} of {c.studentsAssessed})
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Class mastery <span className="font-semibold text-foreground">{Math.round(c.meanPct)}%</span> · {c.assessmentTitle}
          </div>
        </div>

        {plan && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-demo-id="reteach-outcome">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <TrendingUp className="h-4 w-4" /> Reteach {plan.status === "taught" ? `taught ${formatDate(plan.taughtAt)}` : plan.status === "ready" ? "planned" : "in draft"}
            </div>
            {plan.afterPct !== null ? (
              <div className="flex items-baseline gap-2" data-demo-id="mastery-before-after">
                <span className="text-2xl font-semibold tabular-nums">{plan.beforePct}%</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-semibold tabular-nums text-high">{plan.afterPct}%</span>
                <span className="text-muted-foreground">
                  mastery before → after (exit ticket){plan.afterUnder !== null ? ` · ${plan.afterUnder} of ${plan.afterAssessed} still under 50%` : ""}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground">
                Mastery before: <span className="font-semibold text-foreground">{plan.beforePct}%</span>.{" "}
                {plan.exitTicketAssessmentId ? "Grade the exit ticket to see the after." : plan.status === "taught" ? "Create the exit ticket to measure the after." : "Teach it, then grade the exit ticket."}
              </div>
            )}
          </div>
        )}

        {c.misconceptions.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top misconceptions (students)</div>
            <HBarList items={c.misconceptions.slice(0, 4).map((m) => ({ label: m.label, value: m.count }))} demoId="weak-concept-misconceptions" />
          </div>
        )}

        {c.snippets.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">From your students&apos; answers (anonymised)</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.snippets.slice(0, 3).map((s, i) => (
                <figure key={i} className="rounded-lg border bg-[#f8f6f0] p-2" data-demo-id={`weak-concept-snippet-${i}`}>
                  <pre className="whitespace-pre-wrap font-[family-name:var(--font-hand)] text-sm text-[#1d3b9c]">{s.text}</pre>
                  <figcaption className="mt-1 text-[11px] text-muted-foreground">
                    {s.misconception} · {s.source}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button asChild data-demo-id="plan-reteach">
            <Link href={plan ? `/reteach/${plan.id}` : planHref}>
              <BookOpenCheck /> {plan ? "Open reteach plan" : "Plan a reteach"}
            </Link>
          </Button>
          <Button asChild variant="outline" data-demo-id="assign-group-practice">
            <Link href={practiceHref}>
              <ClipboardList /> Assign practice to the group
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
