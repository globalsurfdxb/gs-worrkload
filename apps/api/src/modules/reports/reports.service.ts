import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectStatus, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateKpiSnapshotDto } from "./dto/create-kpi-snapshot.dto";
import { QueryKpisDto } from "./dto/query-kpis.dto";

const LOOKBACK_DAYS = 30;

const PENDING_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.TESTING,
];

interface CapacityUser {
  id: string;
  capacityHoursPerWeek: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyReport() {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      activeEmployees,
      departments,
      totalProjectsByDept,
      completedProjectsByDept,
    ] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.project.count({
        where: { status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] } },
      }),
      this.prisma.project.count({ where: { status: ProjectStatus.COMPLETED } }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, capacityHoursPerWeek: true },
      }),
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.project.groupBy({ by: ["departmentId"], _count: { _all: true } }),
      this.prisma.project.groupBy({
        by: ["departmentId"],
        where: { status: ProjectStatus.COMPLETED },
        _count: { _all: true },
      }),
    ]);

    const totalByDept = new Map(totalProjectsByDept.map((row) => [row.departmentId, row._count._all]));
    const completedByDept = new Map(
      completedProjectsByDept.map((row) => [row.departmentId, row._count._all]),
    );

    const departmentPerformance = departments.map((department) => {
      const total = totalByDept.get(department.id) ?? 0;
      const completed = completedByDept.get(department.id) ?? 0;
      return {
        departmentId: department.id,
        name: department.name,
        completionRate: total > 0 ? this.round2((completed / total) * 100) : 0,
      };
    });

    const resourceUtilizationPct = await this.computeUtilizationPct(activeEmployees);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalEmployees: activeEmployees.length,
      departmentPerformance,
      resourceUtilizationPct: this.round2(resourceUtilizationPct),
    };
  }

  async getDepartmentReport(id: string) {
    await this.ensureDepartmentExists(id);

    const lookbackDate = this.lookbackDate();
    const now = new Date();

    const [activeProjects, activeTasks, overdueTasks, touchedTasks, completedTouchedTasks, departmentUsers] =
      await Promise.all([
        this.prisma.project.count({
          where: {
            departmentId: id,
            status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
          },
        }),
        this.prisma.task.count({
          where: { status: { not: TaskStatus.COMPLETED }, project: { departmentId: id } },
        }),
        this.prisma.task.count({
          where: {
            status: { not: TaskStatus.COMPLETED },
            dueDate: { lt: now },
            project: { departmentId: id },
          },
        }),
        this.prisma.task.count({
          where: { project: { departmentId: id }, updatedAt: { gte: lookbackDate } },
        }),
        this.prisma.task.count({
          where: {
            project: { departmentId: id },
            updatedAt: { gte: lookbackDate },
            status: TaskStatus.COMPLETED,
          },
        }),
        this.prisma.user.findMany({
          where: { departmentId: id, isActive: true },
          select: { id: true, capacityHoursPerWeek: true },
        }),
      ]);

    const teamProductivity =
      touchedTasks > 0 ? this.round2((completedTouchedTasks / touchedTasks) * 100) : 0;
    const utilizationPct = this.round2(await this.computeUtilizationPct(departmentUsers));

    return { activeProjects, activeTasks, overdueTasks, teamProductivity, utilizationPct };
  }

  async getTeamReport(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      select: { capacityHoursPerWeek: true },
    });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found.`);
    }

    const lookbackDate = this.lookbackDate();

    const [assignedTasks, pendingTasks, touchedTasks, completedTouchedTasks] = await Promise.all([
      this.prisma.task.count({ where: { project: { teamId: id } } }),
      this.prisma.task.count({
        where: { project: { teamId: id }, status: { in: PENDING_TASK_STATUSES } },
      }),
      this.prisma.task.count({
        where: { project: { teamId: id }, updatedAt: { gte: lookbackDate } },
      }),
      this.prisma.task.count({
        where: {
          project: { teamId: id },
          updatedAt: { gte: lookbackDate },
          status: TaskStatus.COMPLETED,
        },
      }),
    ]);

    const performanceScore =
      touchedTasks > 0 ? this.round2((completedTouchedTasks / touchedTasks) * 100) : 0;

    return {
      assignedTasks,
      pendingTasks,
      capacity: team.capacityHoursPerWeek,
      performanceScore,
    };
  }

  async getKpis(query: QueryKpisDto) {
    const where: Prisma.KpiSnapshotWhereInput = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
    };

    if (query.from || query.to) {
      where.snapshotDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return this.prisma.kpiSnapshot.findMany({ where, orderBy: { snapshotDate: "desc" } });
  }

  async createKpiSnapshot(dto: CreateKpiSnapshotDto) {
    const hasDepartment = !!dto.departmentId;
    const hasTeam = !!dto.teamId;

    if (hasDepartment === hasTeam) {
      throw new BadRequestException("Provide exactly one of departmentId or teamId.");
    }

    if (hasDepartment) {
      await this.ensureDepartmentExists(dto.departmentId!);
    } else {
      await this.ensureTeamExists(dto.teamId!);
    }

    const scopeWhere: Prisma.TaskWhereInput = hasDepartment
      ? { project: { departmentId: dto.departmentId } }
      : { project: { teamId: dto.teamId } };

    const lookbackDate = this.lookbackDate();

    const [totalTasks, completedTasks, scopedUsers] = await Promise.all([
      this.prisma.task.count({ where: { ...scopeWhere, updatedAt: { gte: lookbackDate } } }),
      this.prisma.task.findMany({
        where: { ...scopeWhere, updatedAt: { gte: lookbackDate }, status: TaskStatus.COMPLETED },
        select: { dueDate: true, updatedAt: true },
      }),
      hasDepartment
        ? this.prisma.user.findMany({
            where: { departmentId: dto.departmentId, isActive: true },
            select: { id: true, capacityHoursPerWeek: true },
          })
        : this.prisma.user.findMany({
            where: { isActive: true, teamMemberships: { some: { teamId: dto.teamId } } },
            select: { id: true, capacityHoursPerWeek: true },
          }),
    ]);

    const taskCompletionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

    // Tasks with no dueDate are treated as compliant by definition.
    const compliantCount = completedTasks.filter(
      (task) => !task.dueDate || task.updatedAt <= task.dueDate,
    ).length;
    const slaCompliancePct =
      completedTasks.length > 0 ? (compliantCount / completedTasks.length) * 100 : 100;

    const utilizationPct = await this.computeUtilizationPct(scopedUsers);
    const productivityScore = Math.min(taskCompletionRate * 0.6 + utilizationPct * 0.4, 100);

    return this.prisma.kpiSnapshot.create({
      data: {
        departmentId: dto.departmentId ?? null,
        teamId: dto.teamId ?? null,
        snapshotDate: new Date(),
        taskCompletionRate: this.round2(taskCompletionRate),
        productivityScore: this.round2(productivityScore),
        utilizationPct: this.round2(utilizationPct),
        slaCompliancePct: this.round2(slaCompliancePct),
      },
    });
  }

  /**
   * For each user: allocatedHours = sum over their assigned, not-yet-completed
   * tasks of (task.estimatedHours / number of assignees on that task). Each
   * user's utilization is allocatedHours / capacityHoursPerWeek * 100; the
   * returned figure is the average across all supplied users, capped at 100.
   */
  private async computeUtilizationPct(users: CapacityUser[]): Promise<number> {
    if (users.length === 0) {
      return 0;
    }

    const userIds = users.map((user) => user.id);

    const assignments = await this.prisma.taskAssignee.findMany({
      where: { userId: { in: userIds }, task: { status: { not: TaskStatus.COMPLETED } } },
      select: {
        userId: true,
        task: { select: { estimatedHours: true, _count: { select: { assignees: true } } } },
      },
    });

    const allocatedHoursByUser = new Map<string, number>();
    for (const assignment of assignments) {
      const assigneeCount = assignment.task._count.assignees || 1;
      const hours = (assignment.task.estimatedHours ?? 0) / assigneeCount;
      allocatedHoursByUser.set(
        assignment.userId,
        (allocatedHoursByUser.get(assignment.userId) ?? 0) + hours,
      );
    }

    const utilizationRates = users.map((user) => {
      const allocatedHours = allocatedHoursByUser.get(user.id) ?? 0;
      const capacity = user.capacityHoursPerWeek || 1;
      return (allocatedHours / capacity) * 100;
    });

    const average = utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length;
    return Math.min(average, 100);
  }

  private lookbackDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - LOOKBACK_DAYS);
    return date;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async ensureDepartmentExists(id: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found.`);
    }
  }

  private async ensureTeamExists(id: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id }, select: { id: true } });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found.`);
    }
  }
}
