"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface ProjectFilterOption {
  id: string;
  name: string;
  count: number;
}

interface ProjectFilterStripProps {
  options: ProjectFilterOption[];
  activeId: string | "ALL";
  onSelect: (id: string | "ALL") => void;
  totalCount: number;
  /** Singular unit noun, e.g. "task" — the plural is derived unless overridden. */
  unitLabel: string;
  unitLabelPlural?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Compact, horizontally-scrollable project filter — a row of pills rather than
 * the large stat-card grid this replaced. Cards wrapped into several rows once
 * the project list grew past a handful; pills stay a single scrollable row no
 * matter how many projects exist, at a fraction of the vertical footprint.
 * Shared by Tasks, Bugs and Sprints — all three filter their list by project.
 */
export function ProjectFilterStrip({
  options,
  activeId,
  onSelect,
  totalCount,
  unitLabel,
  unitLabelPlural,
  isLoading,
  emptyMessage,
}: ProjectFilterStripProps) {
  const plural = unitLabelPlural ?? `${unitLabel}s`;
  const unitFor = (count: number) => (count === 1 ? unitLabel : plural);

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  if (options.length === 0 && emptyMessage) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect("ALL")}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          activeId === "ALL"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:bg-muted",
        )}
      >
        <span>All Projects</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            activeId === "ALL" ? "bg-primary-foreground/20" : "bg-muted",
          )}
        >
          {totalCount}
        </span>
      </button>

      {options.map((option) => {
        const active = activeId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            title={`${option.name} — ${option.count} ${unitFor(option.count)}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            <span className="max-w-[180px] truncate">{option.name}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                active ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
