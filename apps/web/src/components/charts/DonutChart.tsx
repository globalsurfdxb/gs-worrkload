"use client";

import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  /** Always an `hsl(var(--token))` reference so the chart follows the active theme. */
  color: string;
}

interface DonutChartProps {
  /**
   * Pre-ordered segments — this component renders them in the order given.
   * Segment ordering is a colour-adjacency decision and lives with the page.
   */
  data: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}

const STROKE_WIDTH = 22;

/**
 * Ring chart with a mandatory legend. Colour is never the only channel: every
 * segment is spelled out beside the ring with its label, count, and share.
 */
export function DonutChart({
  data,
  size = 160,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const segments = data.filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const radius = (size - STROKE_WIDTH) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Running start angle per segment, in degrees clockwise from 12 o'clock.
  let angleCursor = 0;
  const arcs = segments.map((segment) => {
    const share = total > 0 ? segment.value / total : 0;
    const arc = { segment, share, startAngle: angleCursor, offset: circumference * angleCursor / 360 };
    angleCursor += share * 360;
    return arc;
  });

  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          total > 0
            ? segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")
            : "No data"
        }
        className="shrink-0"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={STROKE_WIDTH}
        />

        {total > 0 &&
          arcs.map((arc) => (
            <circle
              key={arc.segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.segment.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${circumference * arc.share} ${circumference}`}
              strokeDashoffset={-arc.offset}
              // Start at 12 o'clock and run clockwise.
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}

        {/* 2px separators in the card colour, so neighbouring hues never touch. */}
        {arcs.length > 1 &&
          arcs.map((arc) => {
            const radians = ((arc.startAngle - 90) * Math.PI) / 180;
            const inner = radius - STROKE_WIDTH / 2;
            const outer = radius + STROKE_WIDTH / 2;
            return (
              <line
                key={`sep-${arc.segment.label}`}
                x1={center + Math.cos(radians) * inner}
                y1={center + Math.sin(radians) * inner}
                x2={center + Math.cos(radians) * outer}
                y2={center + Math.sin(radians) * outer}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            );
          })}

        {(centerValue !== undefined || centerLabel) && (
          <>
            <text
              x={center}
              y={centerLabel ? center - 2 : center + 6}
              textAnchor="middle"
              className="fill-foreground text-xl font-semibold"
            >
              {centerValue ?? total}
            </text>
            {centerLabel && (
              <text
                x={center}
                y={center + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] uppercase tracking-wide"
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data</p>
      ) : (
        <ul className="flex w-full min-w-0 flex-col gap-2">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate">{segment.label}</span>
              <span className="font-medium">{segment.value}</span>
              <span className="w-11 text-right text-muted-foreground">
                {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
