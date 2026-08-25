"use client";

import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  /** Any CSS colour — always pass an `hsl(var(--token))` reference so both themes work. */
  color?: string;
  className?: string;
}

const WIDTH = 60;
const HEIGHT = 20;
const PADDING = 2;

/**
 * Axis-less trend line for stat cards. Scales to the data's own min/max, so it
 * reads as "shape of the recent trend" rather than an absolute measurement —
 * the exact value always sits next to it as text.
 */
export function Sparkline({ data, color = "hsl(var(--primary))", className }: SparklineProps) {
  const points = data.filter((value) => Number.isFinite(value));
  if (points.length === 0) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const usableHeight = HEIGHT - PADDING * 2;
  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;

  const path = points
    .map((value, index) => {
      const x = points.length > 1 ? index * step : WIDTH / 2;
      const y = PADDING + (1 - (value - min) / span) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-16", className)}
    >
      <path
        d={points.length > 1 ? path : `M0 ${HEIGHT / 2} L${WIDTH} ${HEIGHT / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
