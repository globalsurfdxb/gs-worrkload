import { EmployeeAvailability } from "@gs-workhub/shared";
import type { BadgeProps } from "@/components/ui/badge";

export const EMPLOYEE_AVAILABILITY_LABELS: Record<EmployeeAvailability, string> = {
  [EmployeeAvailability.AVAILABLE]: "Available",
  [EmployeeAvailability.PARTIALLY_AVAILABLE]: "Partially Available",
  [EmployeeAvailability.UNAVAILABLE]: "Unavailable",
  [EmployeeAvailability.ON_LEAVE]: "On Leave",
};

export function availabilityBadgeVariant(availability: EmployeeAvailability): BadgeProps["variant"] {
  switch (availability) {
    case EmployeeAvailability.AVAILABLE:
      return "success";
    case EmployeeAvailability.PARTIALLY_AVAILABLE:
      return "warning";
    case EmployeeAvailability.UNAVAILABLE:
      return "destructive";
    default:
      return "muted";
  }
}

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
