"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  label: string;
  title?: string;
  value: number | null;
  compare?: number | null;
}

const SERIES = "#2a78d6"; // categorical slot 1
const COMPARE = "#eb6834"; // categorical slot 2
const INK = "#52514e";
const GRID = "#e7e5df";

/**
 * Single measure over time (one axis, 0–100%). An optional second series (e.g. class average) gets a
 * legend and direct end labels so identity is never colour alone.
 */
export function TrendLineChart({
  data,
  seriesName,
  compareName,
  height = 220,
  demoId,
}: {
  data: TrendPoint[];
  seriesName: string;
  compareName?: string;
  height?: number;
  demoId?: string;
}) {
  const hasCompare = !!compareName && data.some((d) => d.compare !== undefined && d.compare !== null);
  const last = [...data].reverse().find((d) => d.value !== null);
  return (
    <div data-demo-id={demoId} className="w-full">
      {hasCompare && (
        <div className="mb-2 flex gap-4 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: SERIES }} /> {seriesName}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded border-t-2 border-dashed" style={{ borderColor: COMPARE }} /> {compareName}
          </span>
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} unit="%" width={52} />
            <Tooltip
              cursor={{ stroke: INK, strokeDasharray: "3 3" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e7e5df", fontSize: 12 }}
              labelFormatter={(label, payload) => (payload?.[0]?.payload as TrendPoint | undefined)?.title ?? String(label)}
              formatter={(v, name) => [v === null || v === undefined ? "Absent" : `${Number(v).toFixed(0)}%`, name === "value" ? seriesName : compareName]}
            />
            {hasCompare && <Line type="monotone" dataKey="compare" stroke={COMPARE} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: COMPARE, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} connectNulls />}
            <Line type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} dot={{ r: 4, fill: SERIES, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last && <span className="sr-only">Latest {seriesName}: {last.value?.toFixed(0)}%</span>}
    </div>
  );
}

/** Thin horizontal bars for counts (misconceptions, mistake mix). Values are text, bars carry magnitude. */
export function HBarList({ items, max, unit = "", demoId }: { items: { label: string; value: number; hint?: string }[]; max?: number; unit?: string; demoId?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2" data-demo-id={demoId}>
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {i.value}
              {unit}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full" style={{ width: `${(i.value / top) * 100}%`, background: SERIES }} />
          </div>
          {i.hint && <div className="mt-0.5 text-xs text-muted-foreground">{i.hint}</div>}
        </li>
      ))}
    </ul>
  );
}
