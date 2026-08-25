"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  /** Draws a dashed reference line at this height (e.g. the average). */
  averageValue?: number;
  /** Suffix used in the hover tooltip, e.g. "pts". */
  unit?: string;
  height?: number;
  className?: string;
}

/**
 * Thin vertical bars, built from the same CSS-bar vocabulary as the project
 * timeline and utilization bars elsewhere in the app. Every bar carries its
 * value as a direct label, with an exact-value tooltip on hover.
 */
export function BarChart({
  data,
  averageValue,
  unit,
  height = 180,
  className,
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No data</p>;
  }

  const peak = Math.max(...data.map((item) => item.value), averageValue ?? 0);
  const scaleMax = peak > 0 ? peak * 1.15 : 1;
  const averagePct =
    averageValue !== undefined ? Math.min(100, (averageValue / scaleMax) * 100) : null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full" style={{ height }}>
        {averagePct !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${averagePct}%`, borderColor: "hsl(var(--muted-foreground))" }}
          />
        )}

        <div className="flex h-full w-full items-end gap-2 border-b border-border sm:gap-3">
          {data.map((item, index) => {
            const barPct = scaleMax > 0 ? (item.value / scaleMax) * 100 : 0;
            return (
              <div
                key={item.label}
                className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
              >
                {hovered === index && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
                    {item.label}: {item.value}
                    {unit ? ` ${unit}` : ""}
                  </div>
                )}
                <span className="text-[11px] tabular-nums text-muted-foreground">{item.value}</span>
                <div
                  title={`${item.label}: ${item.value}${unit ? ` ${unit}` : ""}`}
                  className={cn(
                    "w-full max-w-[26px] rounded-t-[4px] bg-primary transition-opacity",
                    hovered !== null && hovered !== index && "opacity-60",
                  )}
                  style={{ height: `${Math.max(barPct, 1)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex w-full gap-2 sm:gap-3">
        {data.map((item) => (
          <span
            key={item.label}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
