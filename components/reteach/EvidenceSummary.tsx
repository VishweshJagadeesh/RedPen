import type { PlanEvidence } from "@/lib/planner/types";

/** What the plan is based on: this class's numbers and misconceptions (no student names). */
export function EvidenceSummary({ evidence }: { evidence: PlanEvidence }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-demo-id="plan-evidence">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Based on your class&apos;s answers in {evidence.assessmentTitle}</div>
      <div className="mt-1 text-sm">
        <span className="font-semibold">{evidence.studentsUnder} of {evidence.studentsAssessed}</span> students under 50% on {evidence.conceptName} · class mastery{" "}
        <span className="font-semibold">{Math.round(evidence.meanPct)}%</span>
      </div>
      <ol className="mt-3 space-y-1 text-sm">
        {evidence.misconceptions.map((m, i) => (
          <li key={m.label} className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
            <span className="flex-1">{m.label}</span>
            <span className="tabular-nums text-muted-foreground">{m.count} students</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
