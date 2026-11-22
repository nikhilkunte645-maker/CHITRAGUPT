import type { ForecastDay } from "../api";
import { formatDate, formatINR } from "../format";

interface ForecastChartProps {
  days: ForecastDay[];
  baseDays?: ForecastDay[];
  width?: number;
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 32, left: 72 };
const BRAND = "#0f766e";
const GREY = "#94a3b8";

/** "DD Mon YYYY" -> "DD Mon" for compact axis labels. */
function shortDate(iso: string): string {
  return formatDate(iso).split(" ").slice(0, 2).join(" ");
}

/**
 * Pure display component: maps server-computed balances to SVG pixel positions.
 * It does not compute any forecast values.
 */
export default function ForecastChart({
  days,
  baseDays,
  width = 640,
  height = 260,
}: ForecastChartProps) {
  if (days.length === 0) {
    return <div className="text-sm text-slate-500">No data</div>;
  }

  const base = baseDays ?? [];
  const n = Math.max(days.length, base.length);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  // Y domain covers zero and every plotted balance, with a little padding.
  const all = [...days, ...base].map((d) => d.balance);
  const rawMin = Math.min(0, ...all);
  const rawMax = Math.max(0, ...all);
  const range = rawMax - rawMin || 1;
  const pad = range * 0.08;
  const lo = rawMin - pad;
  const hi = rawMax + pad;
  const span = hi - lo;

  const xOf = (i: number): number =>
    PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yOf = (v: number): number => PAD.top + ((hi - v) / span) * plotH;

  const toPoints = (series: ForecastDay[]): string =>
    series.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.balance).toFixed(1)}`).join(" ");

  // Marker on the lowest point of the scenario path (position only; the value is the server's balance).
  let lowIdx = 0;
  days.forEach((d, i) => {
    if (d.balance < days[lowIdx].balance) lowIdx = i;
  });
  const low = days[lowIdx];
  const lowX = xOf(lowIdx);
  const lowY = yOf(low.balance);
  const lowLabelY = lowY > PAD.top + plotH / 2 ? lowY - 10 : lowY + 18;
  const lowAnchor = lowIdx > n * 0.8 ? "end" : lowIdx < n * 0.2 ? "start" : "middle";

  const zeroY = yOf(0);

  const lastIdx = days.length - 1;
  const ticks: { i: number; anchor: "start" | "middle" | "end" }[] =
    days.length > 1
      ? [
          { i: 0, anchor: "start" },
          { i: Math.floor(lastIdx / 2), anchor: "middle" },
          { i: lastIdx, anchor: "end" },
        ]
      : [{ i: 0, anchor: "start" }];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      className="h-auto w-full"
      role="img"
    >
      <title>Projected cash balance by day</title>

      {/* Zero line */}
      <line
        x1={PAD.left}
        x2={width - PAD.right}
        y1={zeroY}
        y2={zeroY}
        stroke={GREY}
        strokeWidth={1}
        strokeDasharray="6 4"
      />
      <text x={PAD.left - 6} y={zeroY + 4} textAnchor="end" fontSize={11} className="fill-slate-500">
        ₹0
      </text>

      {/* Y-axis extremes (omitted when equal to zero, which is already labelled) */}
      {rawMax !== 0 ? (
        <text x={PAD.left - 6} y={yOf(rawMax) + 4} textAnchor="end" fontSize={11} className="fill-slate-500">
          {formatINR(rawMax)}
        </text>
      ) : null}
      {rawMin !== 0 ? (
        <text x={PAD.left - 6} y={yOf(rawMin) + 4} textAnchor="end" fontSize={11} className="fill-slate-500">
          {formatINR(rawMin)}
        </text>
      ) : null}

      {/* Base forecast (no delay), drawn underneath */}
      {base.length > 0 ? (
        <polyline
          points={toPoints(base)}
          fill="none"
          stroke={GREY}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      ) : null}

      {/* Scenario path */}
      <polyline
        points={toPoints(days)}
        fill="none"
        stroke={BRAND}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Lowest point marker and label */}
      <circle cx={lowX} cy={lowY} r={4} fill={BRAND} stroke="#ffffff" strokeWidth={1.5} />
      <text
        x={lowX}
        y={lowLabelY}
        textAnchor={lowAnchor}
        fontSize={11}
        fontWeight={600}
        fill={BRAND}
      >
        {formatINR(low.balance)}
      </text>

      {/* X-axis date labels */}
      {ticks.map((t) => (
        <text
          key={t.i}
          x={xOf(t.i)}
          y={height - 10}
          textAnchor={t.anchor}
          fontSize={11}
          className="fill-slate-500"
        >
          {shortDate(days[t.i].date)}
        </text>
      ))}
    </svg>
  );
}
