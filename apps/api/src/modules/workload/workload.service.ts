import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { SystemRole, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import type { EmployeeWorkload, WorkloadStatus } from "./workload.types";

interface EmployeeCandidate {
  id: string;
  fullName: string;
  capacityHoursPerWeek: number;
}

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /workload/employees
   * Non-SUPER_ADMIN callers are always confined to their own department,
   * regardless of the departmentId supplied in the query.
   */
  async getEmployeeWorkloads(
    currentUser: AuthenticatedRequestUser,
    filters: { departmentId?: string; teamId?: string },
  ): Promise<EmployeeWorkload[]> {
    const departmentId = this.resolveDepartmentScope(currentUser, filters.departmentId);

    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
        ...(filters.teamId ? { teamMemberships: { some: { teamId: filters.teamId } } } : {}),
      },
      select: { id: true, fullName: true, capacityHoursPerWeek: true },
      orderBy: { fullName: "asc" },
    });

    return this.computeWorkloads(candidates);
  }

  /** GET /workload/teams/:teamId */
  async getTeamWorkload(currentUser: AuthenticatedRequestUser, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, capacityHoursPerWeek: true, departmentId: true },
    });

    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    if (currentUser.role !== SystemRole.SUPER_ADMIN && team.departmentId !== currentUser.departmentId) {
      throw new ForbiddenException("You do not have access to this team's data.");
    }

    const members = await this.prisma.user.findMany({
      where: { isActive: true, teamMemberships: { some: { teamId } } },
      select: { id: true, fullName: true, capacityHoursPerWeek: true },
      orderBy: { fullName: "asc" },
    });

    const memberWorkloads = await this.computeWorkloads(members);
    const totalAllocatedHours = memberWorkloads.reduce((sum, m) => sum + m.allocatedHours, 0);
    const teamUtilizationPct =
      team.capacityHoursPerWeek > 0 ? (totalAllocatedHours / team.capacityHoursPerWeek) * 100 : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      capacityHoursPerWeek: team.capacityHoursPerWeek,
      members: memberWorkloads,
      teamUtilizationPct: round2(teamUtilizationPct),
    };
  }

  /** GET /workload/departments/:departmentId */
  async getDepartmentWorkload(currentUser: AuthenticatedRequestUser, departmentId: string) {
    if (currentUser.role !== SystemRole.SUPER_ADMIN && departmentId !== currentUser.departmentId) {
      throw new ForbiddenException("You do not have access to this department's data.");
    }

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });

    if (!department) {
      throw new NotFoundException("Department not found.");
    }

    const employees = await this.prisma.user.findMany({
      where: { isActive: true, departmentId },
      select: { id: true, fullName: true, capacityHoursPerWeek: true },
      orderBy: { fullName: "asc" },
    });

    const workloads = await this.computeWorkloads(employees);
    const totalCapacityHours = workloads.reduce((sum, w) => sum + w.capacityHours, 0);
    const totalAllocatedHours = workloads.reduce((sum, w) => sum + w.allocatedHours, 0);
    const utilizationPct = totalCapacityHours > 0 ? (totalAllocatedHours / totalCapacityHours) * 100 : 0;

    return {
      departmentId: department.id,
      departmentName: department.name,
      totalCapacityHours: round2(totalCapacityHours),
      totalAllocatedHours: round2(totalAllocatedHours),
      utilizationPct: round2(utilizationPct),
      employeeCount: workloads.length,
    };
  }

  /** GET /workload/overloaded and GET /workload/underutilized */
  async getEmployeesByStatus(
    currentUser: AuthenticatedRequestUser,
    departmentId: string | undefined,
    status: WorkloadStatus,
  ): Promise<EmployeeWorkload[]> {
    const workloads = await this.getEmployeeWorkloads(currentUser, { departmentId });
    return workloads.filter((w) => w.status === status);
  }

  /**
   * Core calculation, shared by every endpoint: for each candidate employee,
   * sum estimatedHours across their non-completed task assignments, splitting
   * each task's hours evenly across all of its assignees.
   */
  private async computeWorkloads(candidates: EmployeeCandidate[]): Promise<EmployeeWorkload[]> {
    if (candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map((c) => c.id);

    const assignments = await this.prisma.taskAssignee.findMany({
      where: {
        userId: { in: candidateIds },
        task: { status: { not: TaskStatus.COMPLETED } },
      },
      select: {
        userId: true,
        taskId: true,
        task: { select: { estimatedHours: true } },
      },
    });

    const taskIds = [...new Set(assignments.map((a) => a.taskId))];

    const assigneeCounts = taskIds.length
      ? await this.prisma.taskAssignee.groupBy({
          by: ["taskId"],
          where: { taskId: { in: taskIds } },
          _count: { _all: true },
        })
      : [];
    const totalAssigneesByTaskId = new Map(assigneeCounts.map((c) => [c.taskId, c._count._all]));

    const allocatedHoursByUserId = new Map<string, number>();
    for (const assignment of assignments) {
      const estimatedHours = assignment.task.estimatedHours ?? 0;
      const totalAssignees = totalAssigneesByTaskId.get(assignment.taskId) ?? 1;
      const share = totalAssignees > 0 ? estimatedHours / totalAssignees : estimatedHours;
      allocatedHoursByUserId.set(
        assignment.userId,
        (allocatedHoursByUserId.get(assignment.userId) ?? 0) + share,
      );
    }

    return candidates.map((candidate) => {
      const capacityHours = candidate.capacityHoursPerWeek;
      const allocatedHours = allocatedHoursByUserId.get(candidate.id) ?? 0;
      const utilizationPct = capacityHours > 0 ? (allocatedHours / capacityHours) * 100 : 0;

      return {
        employeeId: candidate.id,
        employeeName: candidate.fullName,
        capacityHours,
        allocatedHours: round2(allocatedHours),
        utilizationPct: round2(utilizationPct),
        status: classifyUtilization(utilizationPct),
      };
    });
  }

  /** Non-SUPER_ADMIN callers are always pinned to their own department. */
  private resolveDepartmentScope(
    currentUser: AuthenticatedRequestUser,
    requestedDepartmentId: string | undefined,
  ): string | undefined {
    if (currentUser.role === SystemRole.SUPER_ADMIN) {
      return requestedDepartmentId;
    }
    return currentUser.departmentId ?? requestedDepartmentId;
  }
}

function classifyUtilization(utilizationPct: number): WorkloadStatus {
  if (utilizationPct > 100) return "OVERLOADED";
  if (utilizationPct < 60) return "UNDERUTILIZED";
  return "OPTIMAL";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
