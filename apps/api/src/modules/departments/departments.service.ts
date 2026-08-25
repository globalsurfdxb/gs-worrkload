import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Department, Prisma, ProjectStatus, SystemRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

const MANAGER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  designation: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedRequestUser, includeArchived: boolean) {
    const where: Prisma.DepartmentWhereInput = {
      ...(includeArchived ? {} : { isArchived: false }),
      ...this.scopeFilter(user),
    };

    const departments = await this.prisma.department.findMany({
      where,
      include: {
        _count: { select: { teams: true, employees: true } },
      },
      orderBy: { name: "asc" },
    });

    return departments.map(({ _count, ...department }) => ({
      ...department,
      teamCount: _count.teams,
      employeeCount: _count.employees,
    }));
  }

  async findOne(id: string, user: AuthenticatedRequestUser) {
    this.assertDepartmentAccess(id, user);

    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        teams: true,
        manager: { select: MANAGER_SELECT },
        _count: { select: { teams: true, employees: true } },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department ${id} not found.`);
    }

    const activeProjectCount = await this.prisma.project.count({
      where: {
        departmentId: id,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
      },
    });

    const { _count, ...rest } = department;

    return {
      ...rest,
      dashboard: {
        activeProjectCount,
        employeeCount: _count.employees,
        teamCount: _count.teams,
      },
    };
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Department code "${dto.code}" is already in use.`);
    }

    const organizationId = dto.organizationId ?? (await this.getDefaultOrganizationId());

    return this.prisma.department.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        managerId: dto.managerId,
      },
    });
  }

  /**
   * GS WorkHub is currently single-organization. Callers (the frontend admin
   * UI included) never need to know or send an organization id.
   */
  private async getDefaultOrganizationId(): Promise<string> {
    const organization = await this.prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!organization) {
      throw new ConflictException(
        "No organization exists yet. Seed the database (prisma/seed.ts) before creating departments.",
      );
    }
    return organization.id;
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    await this.getOrThrow(id);

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      },
    });
  }

  async setArchived(id: string, isArchived: boolean): Promise<Department> {
    await this.getOrThrow(id);

    return this.prisma.department.update({
      where: { id },
      data: { isArchived },
    });
  }

  async getResourceAllocation(id: string, user: AuthenticatedRequestUser) {
    this.assertDepartmentAccess(id, user);
    await this.getOrThrow(id);

    const [teams, totalEmployees] = await Promise.all([
      this.prisma.team.findMany({
        where: { departmentId: id },
        select: { capacityHoursPerWeek: true },
      }),
      this.prisma.user.count({ where: { departmentId: id } }),
    ]);

    const totalWeeklyCapacityHours = teams.reduce(
      (sum, team) => sum + team.capacityHoursPerWeek,
      0,
    );

    return {
      totalTeams: teams.length,
      totalEmployees,
      totalWeeklyCapacityHours,
    };
  }

  async getKpis(id: string, user: AuthenticatedRequestUser) {
    this.assertDepartmentAccess(id, user);
    await this.getOrThrow(id);

    return this.prisma.kpiSnapshot.findMany({
      where: { departmentId: id },
      orderBy: { snapshotDate: "desc" },
      take: 12,
    });
  }

  private async getOrThrow(id: string): Promise<Department> {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found.`);
    }
    return department;
  }

  /**
   * Non-SUPER_ADMIN callers only ever see their own department in list/read
   * results; DepartmentScopeGuard does not filter list endpoints for us.
   */
  private scopeFilter(user: AuthenticatedRequestUser): Prisma.DepartmentWhereInput {
    if (user.role === SystemRole.SUPER_ADMIN) {
      return {};
    }
    return { id: user.departmentId ?? "__no_department__" };
  }

  private assertDepartmentAccess(departmentId: string, user: AuthenticatedRequestUser): void {
    if (user.role !== SystemRole.SUPER_ADMIN && user.departmentId !== departmentId) {
      throw new ForbiddenException("You do not have access to this department's data.");
    }
  }
}
