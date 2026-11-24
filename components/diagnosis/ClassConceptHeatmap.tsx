import Link from "next/link";
import type { HeatmapData } from "@/lib/diagnosis/mastery";

/** Diverging scale around the 50% "weak" line: red arm below, grey midpoint, blue arm above. */
const BINS: { max: number; bg: string; fg: string; label: string }[] = [
  { max: 20, bg: "#b83a3a", fg: "#fff", label: "<20" },
  { max: 35, bg: "#dd7b74", fg: "#1f1f1f", label: "20–34" },
  { max: 45, bg: "#efb3ab", fg: "#1f1f1f", label: "35–44" },
  { max: 50, bg: "#f6dbd6", fg: "#1f1f1f", label: "45–49" },
  { max: 60, bg: "#f0efec", fg: "#1f1f1f", label: "50–59" },
  { max: 70, bg: "#cde2fb", fg: "#1f1f1f", label: "60–69" },
  { max: 80, bg: "#9ec5f4", fg: "#1f1f1f", label: "70–79" },
  { max: 90, bg: "#5598e7", fg: "#fff", label: "80–89" },
  { max: 101, bg: "#256abf", fg: "#fff", label: "90+" },
];

export function masteryColor(v: number) {
  return BINS.find((b) => v < b.max) ?? BINS[BINS.length - 1];
}

export interface ClassConceptHeatmapProps {
  data: HeatmapData;
  studentHref: (studentId: string) => string;
  highlightConceptId?: string;
}

/** Students × concepts mastery %, weakest concepts first. Every cell shows its number. */
export function ClassConceptHeatmap({ data, studentHref, highlightConceptId }: ClassConceptHeatmapProps) {
  if (data.concepts.length === 0) return <p className="text-sm text-muted-foreground">No graded concepts yet.</p>;
  return (
    <div className="space-y-3" data-demo-id="class-concept-heatmap">
      <div className="max-h-[560px] overflow-auto rounded-xl border bg-card">
        <table className="border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="sticky left-0 z-20 min-w-[170px] border-b bg-card px-3 py-2 text-left font-medium text-muted-foreground">Student</th>
              {data.concepts.map((c) => (
                <th
                  key={c.id}
                  className={`h-36 min-w-[46px] border-b px-1 align-bottom font-medium ${c.id === highlightConceptId ? "text-primary" : "text-muted-foreground"}`}
                  title={`${c.chapter} › ${c.name} · class mean ${c.classMean}%`}
                  data-demo-id={`heatmap-concept-${c.id}`}
                >
                  <div className="mx-auto w-5 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-left">{c.name}</div>
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 border-b bg-muted/60 px-3 py-1 text-left font-medium">Class mean</th>
              {data.concepts.map((c) => (
                <th key={c.id} className="border-b bg-muted/60 px-1 py-1 text-center font-semibold tabular-nums">
                  {c.classMean}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.studentId} data-demo-id={`heatmap-row-${r.rollNumber}`}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b bg-card px-3 py-1">
                  <Link href={studentHref(r.studentId)} className="hover:underline">
                    {r.rollNumber}. {r.name}
                  </Link>
                </td>
                {r.cells.map((v, i) => {
                  if (v === null) return <td key={i} className="border-b border-l border-card bg-muted/30 text-center text-muted-foreground">—</td>;
                  const c = masteryColor(v);
                  return (
                    <td
                      key={i}
                      className="border-b border-l border-card px-1 py-1 text-center tabular-nums"
                      style={{ background: c.bg, color: c.fg }}
                      title={`${r.name} · ${data.concepts[i].name}: ${v}%`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Colour key">
        <span className="mr-1">Mastery %</span>
        {BINS.map((b) => (
          <span key={b.label} className="rounded px-1.5 py-0.5 tabular-nums" style={{ background: b.bg, color: b.fg }}>
            {b.label}
          </span>
        ))}
        <span className="ml-2">Weakest concepts on the left. Each cell is the student&apos;s most recent evidence on that concept.</span>
      </div>
    </div>
  );
}
