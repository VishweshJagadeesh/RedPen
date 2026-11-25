"use client";
import { CartesianGrid, LabelList, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ClassTrendPoint {
  label: string;
  title: string;
  average: number;
}

export interface ClassTrendChartProps {
  data: ClassTrendPoint[];
  healthy: number;
  critical: number;
  notable: number;
  height?: number;
  demoId?: string;
}

// Status bands (fixed palette, always paired with a text label).
const BAND = {
  healthy: { fill: "#0ca30c", text: "#0b6b0b", label: "Healthy" },
  critical: { fill: "#fab219", text: "#7a5200", label: "Critical" },
  poor: { fill: "#d03b3b", text: "#9b2424", label: "Poor" },
};
const LINE = "#1d2b4f";
const INK = "#52514e";
const GRID = "#e7e5df";

export function bandOf(v: number, healthy: number, critical: number) {
  return v >= healthy ? "healthy" : v >= critical ? "critical" : "poor";
}

/**
 * Class average per test. The y-axis zooms to the data so a 5–10 point change is visibly steep, and
 * green / yellow / red bands show whether the average is healthy, critical or poor.
 */
export function ClassTrendChart({ data, healthy, critical, notable, height = 260, demoId }: ClassTrendChartProps) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.average);
  const lo = Math.max(0, Math.floor((Math.min(...values, critical + 2) - 12) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...values, healthy - 2) + 8) / 5) * 5);
  const rows = data.map((d, i) => ({ ...d, change: i === 0 ? null : Math.round((d.average - data[i - 1].average) * 10) / 10 }));
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += hi - lo > 40 ? 10 : 5) ticks.push(t);

  return (
    <div data-demo-id={demoId}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 28, right: 36, bottom: 4, left: 8 }}>
            <ReferenceArea y1={healthy} y2={hi} fill={BAND.healthy.fill} fillOpacity={0.09} ifOverflow="hidden" />
            <ReferenceArea y1={critical} y2={healthy} fill={BAND.critical.fill} fillOpacity={0.14} ifOverflow="hidden" />
            <ReferenceArea y1={lo} y2={critical} fill={BAND.poor.fill} fillOpacity={0.09} ifOverflow="hidden" />
            <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis domain={[lo, hi]} ticks={ticks} tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} unit="%" width={48} allowDataOverflow />
            <Tooltip
              cursor={{ stroke: INK, strokeDasharray: "3 3" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e7e5df", fontSize: 12 }}
              labelFormatter={(_l, payload) => (payload?.[0]?.payload as ClassTrendPoint | undefined)?.title ?? ""}
              formatter={(v, _n, item) => {
                const row = item.payload as { change: number | null };
                const band = BAND[bandOf(Number(v), healthy, critical)].label;
                const ch = row.change === null ? "" : ` · ${row.change > 0 ? "+" : ""}${row.change} pts`;
                return [`${Number(v).toFixed(1)}% (${band})${ch}`, "Class average"];
              }}
            />
            <Line
              type="linear"
              dataKey="average"
              stroke={LINE}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: ClassTrendPoint; index?: number }) => {
                const band = BAND[bandOf(props.payload?.average ?? 0, healthy, critical)];
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={6} fill={band.fill} stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={{ r: 8 }}
            >
              <LabelList
                dataKey="average"
                content={(p: { x?: number | string; y?: number | string; index?: number }) => {
                  const row = rows[p.index ?? 0];
                  if (!row || p.x === undefined || p.y === undefined) return null;
                  const x = Number(p.x);
                  const y = Number(p.y);
                  const big = row.change !== null && Math.abs(row.change) >= notable;
                  const color = row.change === null || !big ? INK : row.change < 0 ? BAND.poor.text : BAND.healthy.text;
                  return (
                    <g>
                      <text x={x} y={y - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="#1f1f1f">
                        {Math.round(row.average)}%
                      </text>
                      {row.change !== null && (
                        <text x={x} y={y + 22} textAnchor="middle" fontSize={11} fontWeight={big ? 700 : 400} fill={color}>
                          {row.change < 0 ? "▼" : row.change > 0 ? "▲" : "–"} {Math.abs(row.change).toFixed(0)}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Bands">
        {(
          [
            ["healthy", `Healthy ≥ ${healthy}%`],
            ["critical", `Critical ${critical}–${healthy - 1}%`],
            ["poor", `Poor < ${critical}%`],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: BAND[k].fill, opacity: 0.45 }} /> {label}
          </span>
        ))}
        <span>▲▼ change from the previous test (bold when ≥ {notable} points)</span>
      </div>
    </div>
  );
}
