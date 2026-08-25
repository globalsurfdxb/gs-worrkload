import { Priority, ProjectStatus, TaskStatus } from "@/lib/shared";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** Formats an ISO date string for display, e.g. "Aug 18, 2026". Returns "—" when absent/invalid. */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Formats an ISO date string for a native <input type="date"> value ("YYYY-MM-DD"). */
export function formatDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Converts a plain "YYYY-MM-DD" (from a date input) into a full ISO datetime string for the API. */
export function toIsoDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: "Planning",
  [ProjectStatus.IN_PROGRESS]: "In Progress",
  [ProjectStatus.ON_HOLD]: "On Hold",
  [ProjectStatus.REVIEW]: "Review",
  [ProjectStatus.COMPLETED]: "Completed",
  [ProjectStatus.CANCELLED]: "Cancelled",
};

export function projectStatusBadgeVariant(status: ProjectStatus): BadgeVariant {
  switch (status) {
    case ProjectStatus.PLANNING:
      return "secondary";
    case ProjectStatus.IN_PROGRESS:
      return "default";
    case ProjectStatus.ON_HOLD:
      return "warning";
    case ProjectStatus.REVIEW:
      return "outline";
    case ProjectStatus.COMPLETED:
      return "success";
    case ProjectStatus.CANCELLED:
      return "destructive";
    default:
      return "secondary";
  }
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.CRITICAL]: "Critical",
  [Priority.HIGH]: "High",
  [Priority.MEDIUM]: "Medium",
  [Priority.LOW]: "Low",
};

export function priorityBadgeVariant(priority: Priority): BadgeVariant {
  switch (priority) {
    case Priority.CRITICAL:
      return "destructive";
    case Priority.HIGH:
      return "warning";
    case Priority.MEDIUM:
      return "secondary";
    case Priority.LOW:
      return "muted";
    default:
      return "secondary";
  }
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.REVIEW]: "Review",
  [TaskStatus.TESTING]: "Testing",
  [TaskStatus.COMPLETED]: "Completed",
};

export function taskStatusBadgeVariant(status: TaskStatus): BadgeVariant {
  switch (status) {
    case TaskStatus.BACKLOG:
      return "muted";
    case TaskStatus.TODO:
      return "secondary";
    case TaskStatus.IN_PROGRESS:
      return "default";
    case TaskStatus.REVIEW:
      return "outline";
    case TaskStatus.TESTING:
      return "warning";
    case TaskStatus.COMPLETED:
      return "success";
    default:
      return "secondary";
  }
}

/** Solid background class used for timeline bars — mirrors the task status badge palette. */
export function taskStatusBarClass(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.BACKLOG:
      return "bg-muted-foreground/40";
    case TaskStatus.TODO:
      return "bg-secondary-foreground/60";
    case TaskStatus.IN_PROGRESS:
      return "bg-primary";
    case TaskStatus.REVIEW:
      return "bg-accent-foreground/60";
    case TaskStatus.TESTING:
      return "bg-warning";
    case TaskStatus.COMPLETED:
      return "bg-success";
    default:
      return "bg-primary";
  }
}

export function healthScoreBadgeVariant(score: number): BadgeVariant {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "destructive";
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.TESTING,
  TaskStatus.COMPLETED,
];
