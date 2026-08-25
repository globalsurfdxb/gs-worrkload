"use client";

import { useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export interface AreaPoint {
  /** "YYYY-MM-DD" */
  date: string;
  value: number;
}

interface AreaLineChartProps {
  data: AreaPoint[];
  /** Label used in the tooltip after the value, e.g. "bugs". */
  unit?: string;
  height?: number;
  className?: string;
}

const VIEW_W = 600;
const VIEW_H = 200;
const GRADIENT_ID = "gs-area-line-gradient";

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Daily trend line with a soft filled area and a hover crosshair. The SVG
 * stretches to the container width (`preserveAspectRatio="none"`); the crosshair,
 * marker, and tooltip are HTML so they stay circular and legible at any width.
 */
export function AreaLineChart({ data, unit, height = 200, className }: AreaLineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const firstPoint = data[0];
  const lastPoint = data[data.length - 1];
  if (!firstPoint || !lastPoint) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No data</p>;
  }

  const midPoint = data.length > 2 ? data[Math.floor(data.length / 2)] : undefined;
  const peak = Math.max(...data.map((point) => point.value), 1);
  const scaleMax = peak * 1.2;
  const step = data.length > 1 ? VIEW_W / (data.length - 1) : 0;

  const coords = data.map((point, index) => ({
    x: data.length > 1 ? index * step : VIEW_W / 2,
    y: VIEW_H - (point.value / scaleMax) * VIEW_H,
  }));

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`;

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.round(ratio * (data.length - 1));
    setHovered(Math.min(data.length - 1, Math.max(0, index)));
  }

  const activePoint = hovered === null ? undefined : data[hovered];
  const activeLeftPct = hovered === null || data.length < 2 ? 50 : (hovered / (data.length - 1)) * 100;
  const activeBottomPct = activePoint ? (activePoint.value / scaleMax) * 100 : 0;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative w-full"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={`Daily count from ${formatDay(firstPoint.date)} to ${formatDay(
            lastPoint.date,
          )}, peak ${peak}`}
        >
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {[0.33, 0.66].map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={VIEW_W}
              y1={VIEW_H * fraction}
              y2={VIEW_H * fraction}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={areaPath} fill={`url(#${GRADIENT_ID})`} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {activePoint && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-full border-l border-dashed"
              style={{ left: `${activeLeftPct}%`, borderColor: "hsl(var(--muted-foreground))" }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2"
              style={{
                left: `${activeLeftPct}%`,
                bottom: `${activeBottomPct}%`,
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--destructive))",
              }}
            />
            <div
              className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
              style={{
                left: `${Math.min(92, Math.max(8, activeLeftPct))}%`,
              }}
            >
              <span className="font-medium">{formatDay(activePoint.date)}</span>
              <span className="ml-2 text-muted-foreground">
                {activePoint.value}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDay(firstPoint.date)}</span>
        {midPoint && <span>{formatDay(midPoint.date)}</span>}
        <span>{formatDay(lastPoint.date)}</span>
      </div>
    </div>
  );
}
