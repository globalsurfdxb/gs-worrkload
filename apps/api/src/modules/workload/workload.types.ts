/**
 * Mirrors `WorkloadSummary` in packages/shared/src/types.ts. Kept local (rather
 * than imported from the shared package) since this module only needs the
 * shape for its own return types.
 */
export type WorkloadStatus = "OVERLOADED" | "OPTIMAL" | "UNDERUTILIZED";

export interface EmployeeWorkload {
  employeeId: string;
  employeeName: string;
  capacityHours: number;
  allocatedHours: number;
  utilizationPct: number;
  status: WorkloadStatus;
}
