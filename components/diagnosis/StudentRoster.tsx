"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BellRing, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { masteryColor } from "@/lib/ui/mastery-color";
import type { RosterRow } from "@/lib/diagnosis/mastery";
import { cn } from "@/lib/utils";

export interface StudentRosterRow extends RosterRow {
  flagged: boolean;
}

export interface StudentRosterProps {
  rows: StudentRosterRow[];
  seriesLabels: string[];
  weakConcepts: { id: string; name: string }[];
  /** Student links are `${studentHrefBase}/${studentId}`. */
  studentHrefBase: string;
}

type Filter = "all" | "attention" | "weak" | "homework";
type Sort = "roll" | "latest" | "drop" | "name";

function Sparkline({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 84;
  const h = 26;
  const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (w - 6);
  const y = (v: number) => h - 3 - (v / 100) * (h - 6);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} role="img" aria-label={`Scores: ${pts.map((p) => `${labels[p.i]} ${p.v}%`).join(", ")}`}>
      <line x1={0} x2={w} y1={y(50)} y2={y(50)} stroke="#e7e5df" strokeDasharray="2 2" />
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="#2a78d6" strokeWidth={1.5} />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.5} fill="#2a78d6" />
    </svg>
  );
}

/** Find any student quickly: search by name or roll number, filter to who needs help, sort by drops. */
export function StudentRoster({ rows, seriesLabels, weakConcepts, studentHrefBase }: StudentRosterProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("roll");
  const counts = {
    attention: rows.filter((r) => r.flagged).length,
    weak: rows.filter((r) => r.weakOnClassConcepts.length > 0).length,
    homework: rows.filter((r) => r.homework.total > 0 && r.homework.submitted < r.homework.total).length,
  };
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.rollNumber) === q)
      .filter((r) =>
        filter === "attention" ? r.flagged : filter === "weak" ? r.weakOnClassConcepts.length > 0 : filter === "homework" ? r.homework.submitted < r.homework.total : true,
      )
      .sort((a, b) =>
        sort === "roll"
          ? a.rollNumber - b.rollNumber
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "latest"
              ? (a.latestPct ?? 999) - (b.latestPct ?? 999)
              : (a.change ?? 999) - (b.change ?? 999),
      );
  }, [rows, query, filter, sort]);
  const conceptName = (id: string) => weakConcepts.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-3" data-demo-id="student-roster">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or roll number" className="pl-8" data-demo-id="student-search" aria-label="Search students" />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter students">
          {(
            [
              ["all", `All (${rows.length})`],
              ["attention", `Needs attention (${counts.attention})`],
              ["weak", `Weak on a class-wide concept (${counts.weak})`],
              ["homework", `Missed homework (${counts.homework})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-demo-id={`roster-filter-${k}`}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === k ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}
              aria-pressed={filter === k}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground" data-demo-id="roster-count">
          {visible.length} of {rows.length}
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Sort
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 w-44" data-demo-id="roster-sort">
            <option value="roll">Roll number</option>
            <option value="latest">Lowest latest score</option>
            <option value="drop">Biggest drop</option>
            <option value="name">Name</option>
          </NativeSelect>
        </label>
      </div>

      <div className="max-h-[620px] overflow-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Student</th>
              <th className="px-3 py-2 text-right font-medium">Latest test</th>
              <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Tests this term</th>
              <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">Weakest concept</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Homework</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const weakest = r.weakest ? masteryColor(r.weakest.pct) : null;
              return (
                <tr key={r.studentId} className="border-b last:border-0 hover:bg-muted/40" data-demo-id={`roster-row-${r.rollNumber}`}>
                  <td className="px-3 py-2">
                    <Link href={`${studentHrefBase}/${r.studentId}`} className="font-medium hover:underline">
                      <span className="mr-2 inline-block w-6 tabular-nums text-muted-foreground">{r.rollNumber}</span>
                      {r.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1 pl-8">
                      {r.flagged && (
                        <Badge variant="low">
                          <BellRing /> Alert
                        </Badge>
                      )}
                      {r.weakOnClassConcepts.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {conceptName(c)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.latestPct === null ? (
                      "—"
                    ) : (
                      <>
                        <span className="font-semibold">{r.latestPct}%</span>
                        {r.change !== null && (
                          <span className={cn("ml-2 text-xs", r.change <= -10 ? "font-semibold text-low" : r.change >= 10 ? "text-high" : "text-muted-foreground")}>
                            {r.change < 0 ? "▼" : r.change > 0 ? "▲" : "–"} {Math.abs(r.change)}
                          </span>
                        )}
                        <div className="text-[11px] text-muted-foreground">{r.latestTitle}</div>
                      </>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <Sparkline values={r.series} labels={seriesLabels} />
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    {r.weakest && weakest ? (
                      <span className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums" style={{ background: weakest.bg, color: weakest.fg }}>
                          {r.weakest.pct}%
                        </span>
                        <span className="text-xs">{r.weakest.name}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs sm:table-cell">
                    {r.homework.total === 0 ? (
                      "—"
                    ) : (
                      <>
                        <span className={cn(r.homework.submitted < r.homework.total && "font-semibold text-low")}>
                          {r.homework.submitted}/{r.homework.total} done
                        </span>
                        {r.homework.average !== null && <span className="text-muted-foreground"> · avg {r.homework.average}%</span>}
                      </>
                    )}
                  </td>
                  <td className="pr-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No students match{query ? ` "${query}"` : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
