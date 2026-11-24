import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { EmptyState } from "@/components/shared/States";
import { ClassConceptHeatmap } from "./ClassConceptHeatmap";
import { FlaggedStudentsList } from "./FlaggedStudentsList";
import { WeakConceptCard } from "./WeakConceptCard";
import type { SectionDashboardData } from "@/lib/queries/section";
import { config } from "@/lib/config";

export function ClassDashboard({ data }: { data: SectionDashboardData }) {
  const sid = data.section.id;
  const open = data.flags.filter((f) => f.status !== "resolved");
  return (
    <div className="space-y-8" data-demo-id="class-dashboard">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Class-wide weak concepts</h2>
          <span className="text-xs text-muted-foreground">
            Weak when ≥{Math.round(config.diagnosis.classWeakShare * 100)}% of students scored under {config.diagnosis.weakScore}% in the latest test that covered it
          </span>
        </div>
        {data.weakConcepts.length === 0 ? (
          <EmptyState title="No class-wide weak concepts" description="Individual students may still need help — see the heatmap and alerts below." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
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

      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Section average per test</CardTitle>
            <CardDescription>Weekly and periodic tests, finalised only.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.trend.length ? (
              <TrendLineChart
                demoId="section-trend"
                seriesName={`Class ${data.section.name} average`}
                data={data.trend.map((t) => ({ label: t.shortTitle, title: t.title, value: t.average }))}
              />
            ) : (
              <EmptyState title="No finalised tests yet" />
            )}
          </CardContent>
        </Card>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Needs attention ({open.length})</h2>
          <FlaggedStudentsList flags={open} showSection={false} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Concept mastery heatmap</h2>
        <ClassConceptHeatmap data={data.heatmap} studentHref={(id) => `/sections/${sid}/students/${id}`} />
      </section>
    </div>
  );
}
