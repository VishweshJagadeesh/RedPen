"use client";
import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bandTextClass } from "@/components/shared/ConfidenceBadge";
import type { ConfidenceBand } from "@/lib/domain";
import { formatMarks, formatPct } from "@/lib/format";
import type { ResultsData } from "@/lib/queries/review";
import { cn } from "@/lib/utils";

export interface ResultsTableProps {
  data: ResultsData;
  csvHref: string;
  reviewHref: string;
  studentHref: (studentId: string) => string;
}

const BAND_ICON: Record<ConfidenceBand, string> = { high: "●", medium: "◆", low: "▲" };

/** Students × questions with totals, a confidence-band filter and CSV export. */
export function ResultsTable({ data, csvHref, reviewHref, studentHref }: ResultsTableProps) {
  const [band, setBand] = useState<"all" | ConfidenceBand>("all");
  const rows = band === "all" ? data.rows : data.rows.filter((r) => r.bands.includes(band));
  const present = data.rows.filter((r) => !r.absent && r.pct !== null);
  const avg = present.length ? present.reduce((s, r) => s + (r.pct ?? 0), 0) / present.length : 0;
  const qAvg = data.questions.map((_, qi) => {
    const vals = present.map((r) => r.cells[qi]).filter(Boolean);
    return vals.length ? vals.reduce((s, c) => s + c!.marks / c!.max, 0) / vals.length : 0;
  });
  return (
    <div className="space-y-4" data-demo-id="results-table">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={band} onValueChange={(v) => setBand(v as typeof band)}>
          <TabsList>
            <TabsTrigger value="all" data-demo-id="results-filter-all">All</TabsTrigger>
            <TabsTrigger value="low" data-demo-id="results-filter-low">▲ Low</TabsTrigger>
            <TabsTrigger value="medium" data-demo-id="results-filter-medium">◆ Medium</TabsTrigger>
            <TabsTrigger value="high" data-demo-id="results-filter-high">● High</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-sm text-muted-foreground">
          Class average <span className="font-semibold text-foreground">{formatPct(avg)}</span> · {present.length} present · {data.rows.length - present.length} absent
        </div>
        <div className="ml-auto flex gap-2">
          {data.assessment.status !== "final" && (
            <Button asChild variant="outline" size="sm">
              <Link href={reviewHref}>Back to review</Link>
            </Button>
          )}
          <Button asChild size="sm" data-demo-id="export-csv">
            <a href={csvHref}>
              <Download /> Export CSV
            </a>
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Student</th>
              {data.questions.map((q) => (
                <th key={q.id} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                  Q{q.number}
                  <div className="font-normal">/{formatMarks(q.maxMarks)}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total /{formatMarks(data.maxTotal)}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.submissionId} className="border-b last:border-0 hover:bg-muted/30" data-demo-id={`results-row-${r.rollNumber}`}>
                <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-1.5">
                  {r.studentId ? (
                    <Link href={studentHref(r.studentId)} className="hover:underline">
                      {r.rollNumber}. {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                {r.absent ? (
                  <td colSpan={data.questions.length} className="px-2 py-1.5 text-center text-xs italic text-muted-foreground">
                    Absent
                  </td>
                ) : (
                  r.cells.map((c, i) => (
                    <td key={i} className={cn("px-2 py-1.5 text-center tabular-nums", c && c.marks < c.max * 0.5 && "bg-low-bg/50", band !== "all" && c?.band !== band && "opacity-35")}>
                      {c ? (
                        <span title={`${c.band} confidence${c.overridden ? " · changed by you" : ""}${c.status === "pending_review" ? " · not reviewed" : ""}`}>
                          {formatMarks(c.marks)}
                          <span className={cn("ml-0.5 text-[9px]", bandTextClass(c.band))} aria-label={`${c.band} confidence`}>
                            {BAND_ICON[c.band]}
                          </span>
                          {c.overridden && <span className="text-[9px] text-primary">✎</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))
                )}
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">{r.total === null ? "—" : formatMarks(r.total)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatPct(r.pct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 text-xs">
            <tr>
              <td className="sticky left-0 bg-muted/40 px-3 py-2 font-medium">Question average</td>
              {qAvg.map((v, i) => (
                <td key={i} className="px-2 py-2 text-center tabular-nums">
                  {formatPct(v * 100)}
                </td>
              ))}
              <td />
              <td className="px-3 py-2 text-right font-medium">{formatPct(avg)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">● High ◆ Medium ▲ Low confidence · ✎ changed by you · shaded cells are under 50% of the marks.</p>
    </div>
  );
}
