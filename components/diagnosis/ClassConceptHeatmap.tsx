"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { HeatmapData } from "@/lib/diagnosis/mastery";
import { cn } from "@/lib/utils";
import { MASTERY_BINS as BINS, masteryColor } from "@/lib/ui/mastery-color";

export interface ClassConceptHeatmapProps {
  data: HeatmapData;
  /** Student links are `${studentHrefBase}/${studentId}`. */
  studentHrefBase: string;
  weakConceptIds?: string[];
  highlightConceptId?: string;
}

type SortKey = "roll" | "lowest" | "name";

/**
 * Students × concepts mastery %. Weakest concepts first (or grouped by chapter), class-wide weak
 * concepts marked, every cell shows its number, with search, filtering and sorting for 50+ rows.
 */
export function ClassConceptHeatmap({ data, studentHrefBase, weakConceptIds = [], highlightConceptId }: ClassConceptHeatmapProps) {
  const [query, setQuery] = useState("");
  const [byChapter, setByChapter] = useState(false);
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [sort, setSort] = useState<SortKey>("roll");

  const columns = useMemo(() => {
    const cols = data.concepts.map((c, i) => ({ ...c, index: i }));
    if (!byChapter) return cols;
    const order = [...new Set(cols.map((c) => c.chapter))];
    return [...cols].sort((a, b) => order.indexOf(a.chapter) - order.indexOf(b.chapter) || a.classMean - b.classMean);
  }, [data.concepts, byChapter]);

  const chapters = useMemo(() => {
    const groups: { chapter: string; span: number }[] = [];
    for (const c of columns) {
      const last = groups.at(-1);
      if (last && last.chapter === c.chapter) last.span++;
      else groups.push({ chapter: c.chapter, span: 1 });
    }
    return groups;
  }, [columns]);

  const weakIdx = new Set(data.concepts.map((c, i) => (weakConceptIds.includes(c.id) ? i : -1)).filter((i) => i >= 0));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const avg = (cells: (number | null)[]) => {
      const v = cells.filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 101;
    };
    return data.rows
      .filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.rollNumber) === q)
      .filter((r) => !onlyWeak || r.cells.some((v, i) => weakIdx.has(i) && v !== null && v < 50))
      .sort((a, b) => (sort === "roll" ? a.rollNumber - b.rollNumber : sort === "name" ? a.name.localeCompare(b.name) : avg(a.cells) - avg(b.cells)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows, query, onlyWeak, sort, weakConceptIds.join(",")]);

  if (data.concepts.length === 0) return <p className="text-sm text-muted-foreground">No graded concepts yet.</p>;
  return (
    <div className="space-y-3" data-demo-id="class-concept-heatmap">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a student or roll no." className="pl-8" data-demo-id="heatmap-search" aria-label="Find a student in the heatmap" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={byChapter} onCheckedChange={setByChapter} data-demo-id="heatmap-group-chapter" /> Group by chapter
        </label>
        {weakConceptIds.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyWeak} onCheckedChange={setOnlyWeak} data-demo-id="heatmap-only-weak" /> Only students under 50% on a weak concept
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          Sort
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 w-40" data-demo-id="heatmap-sort">
            <option value="roll">Roll number</option>
            <option value="lowest">Lowest mastery first</option>
            <option value="name">Name</option>
          </NativeSelect>
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {data.rows.length} students
        </span>
      </div>

      <div className="max-h-[600px] overflow-auto rounded-xl border bg-card">
        <table className="border-separate border-spacing-[2px] text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            {byChapter && (
              <tr>
                <th className="sticky left-0 z-20 bg-card" />
                {chapters.map((g, i) => (
                  <th key={`${g.chapter}-${i}`} colSpan={g.span} className="border-b-2 border-border px-1 pb-1 pt-2 text-left text-[11px] font-semibold text-muted-foreground">
                    <span className="line-clamp-1" title={g.chapter}>
                      {g.chapter}
                    </span>
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th className="sticky left-0 z-20 min-w-[190px] bg-card px-2 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">Student</th>
              {columns.map((c) => {
                const weak = weakConceptIds.includes(c.id);
                return (
                  <th
                    key={c.id}
                    className={cn("w-[78px] min-w-[78px] px-1 pb-1 pt-2 text-left align-bottom font-medium", weak ? "text-low" : c.id === highlightConceptId ? "text-primary" : "text-muted-foreground")}
                    title={`${c.chapter} › ${c.name} · class mean ${c.classMean}%${weak ? " · class-wide weak" : ""}`}
                    data-demo-id={`heatmap-concept-${c.id}`}
                  >
                    {weak && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide">▲ Weak</div>}
                    <div className="line-clamp-2 leading-tight">{c.shortName}</div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-muted/70 px-2 py-1 text-left font-semibold">Class mean</th>
              {columns.map((c) => (
                <th key={c.id} className={cn("rounded-sm bg-muted/70 py-1 text-center font-semibold tabular-nums", weakConceptIds.includes(c.id) && "text-low")}>
                  {c.classMean}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="group" data-demo-id={`heatmap-row-${r.rollNumber}`}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 group-hover:bg-muted">
                  <Link href={`${studentHrefBase}/${r.studentId}`} className="hover:underline">
                    <span className="inline-block w-6 tabular-nums text-muted-foreground">{r.rollNumber}</span>
                    {r.name}
                  </Link>
                </td>
                {columns.map((c) => {
                  const v = r.cells[c.index];
                  if (v === null) return <td key={c.id} className="rounded-sm bg-muted/30 text-center text-muted-foreground">—</td>;
                  const col = masteryColor(v);
                  return (
                    <td key={c.id} className="h-7 rounded-sm text-center tabular-nums" style={{ background: col.bg, color: col.fg }} title={`${r.name} · ${c.name}: ${v}%`}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-6 text-center text-sm text-muted-foreground">
                  No students match.
                </td>
              </tr>
            )}
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
        <span className="ml-2">{byChapter ? "Grouped by chapter, weakest first within each." : "Weakest concepts on the left."} Each cell is the student&apos;s most recent evidence (tests and homework).</span>
      </div>
    </div>
  );
}
