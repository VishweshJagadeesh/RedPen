import { TrendLineChart, type TrendPoint } from "@/components/charts/TrendLineChart";
import type { PtmStatement } from "@/lib/ptm/summary";

export interface StudentProfileProps {
  student: { name: string; section: string };
  teacherName: string;
  trend: TrendPoint[];
  scores: { title: string; date: string; pct: number | null }[];
  strengths: PtmStatement[];
  focusAreas: PtmStatement[];
  pending: string[];
}

/**
 * Read-only profile shared with parents through an unguessable link. Intentionally basic:
 * grades over time, strengths, weak concepts and pending work. No contact details, no photos.
 */
export function StudentProfile({ student, teacherName, trend, scores, strengths, focusAreas, pending }: StudentProfileProps) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6" data-demo-id="student-profile">
      <header>
        <div className="text-sm text-muted-foreground">Mathematics · Class {student.section}</div>
        <h1 className="text-3xl font-semibold tracking-tight">{student.name}</h1>
        <p className="text-sm text-muted-foreground">Shared by {teacherName}. Read-only.</p>
      </header>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Grades over time</h2>
        <TrendLineChart data={trend} seriesName={student.name.split(" ")[0]} compareName="Class average" demoId="profile-trend" />
        <table className="mt-3 w-full text-sm">
          <tbody>
            {scores.map((s) => (
              <tr key={s.title} className="border-b last:border-0">
                <td className="py-1.5">{s.title}</td>
                <td className="py-1.5 text-muted-foreground">{s.date}</td>
                <td className="py-1.5 text-right tabular-nums">{s.pct === null ? "Absent" : `${s.pct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-semibold text-high">✓ Strengths</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm" data-demo-id="profile-strengths">
            {strengths.length ? strengths.map((s, i) => <li key={i}>{s.en}</li>) : <li className="text-muted-foreground">Not enough graded work yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-semibold text-low">▲ To work on</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm" data-demo-id="profile-weak-concepts">
            {focusAreas.length ? focusAreas.map((s, i) => <li key={i}>{s.en}</li>) : <li className="text-muted-foreground">No weak concepts right now.</li>}
          </ul>
        </section>
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Pending work</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm" data-demo-id="profile-pending">
          {pending.length ? pending.map((p, i) => <li key={i}>{p}</li>) : <li className="text-muted-foreground">Nothing pending.</li>}
        </ul>
      </section>
    </main>
  );
}
