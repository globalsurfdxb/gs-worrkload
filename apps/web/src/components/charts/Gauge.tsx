"use client";

import { cn } from "@/lib/utils";

interface GaugeProps {
  /** Percentage, 0–100. Values outside the range are clamped. */
  value: number;
  label?: string;
  className?: string;
}

const WIDTH = 200;
const HEIGHT = 118;
const RADIUS = 80;
const STROKE = 14;
const ARC = `M ${WIDTH / 2 - RADIUS} 100 A ${RADIUS} ${RADIUS} 0 0 1 ${WIDTH / 2 + RADIUS} 100`;
const ARC_LENGTH = Math.PI * RADIUS;

/** Semicircular progress gauge — the number is always shown, not just the arc. */
export function Gauge({ value, label, className }: GaugeProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-[220px]"
        role="img"
        aria-label={`${Math.round(pct)}% ${label ?? "complete"}`}
      >
        <path
          d={ARC}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={ARC}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={ARC_LENGTH * (1 - pct / 100)}
        />
        <text
          x={WIDTH / 2}
          y={86}
          textAnchor="middle"
          className="fill-foreground text-[28px] font-semibold"
        >
          {Math.round(pct)}%
        </text>
        {label && (
          <text
            x={WIDTH / 2}
            y={109}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
