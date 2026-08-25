import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SystemRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

const BCRYPT_ROUNDS = 12;
const WORK_HISTORY_LOOKBACK_DAYS = 90;

// Directory-safe projection: never select passwordHash.
const EMPLOYEE_DIRECTORY_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  designation: true,
  skills: true,
  availability: true,
  capacityHoursPerWeek: true,
  avatarUrl: true,
  departmentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

// Full profile projection: adds department + team memberships, still no passwordHash.
const EMPLOYEE_PROFILE_SELECT = {
  ...EMPLOYEE_DIRECTORY_SELECT,
  department: true,
  teamMemberships: {
    include: { team: true },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEmployeesDto, currentUser: AuthenticatedRequestUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (this.isUnrestricted(currentUser)) {
      if (query.departmentId) {
        where.departmentId = query.departmentId;
      }
    } else {
      // Non-SUPER_ADMIN / non-DEPARTMENT_MANAGER callers only ever see their own department.
      where.departmentId = currentUser.departmentId;
    }

    if (query.teamId) {
      where.teamMemberships = { some: { teamId: query.teamId } };
    }

    if (query.skill) {
      where.skills = { has: query.skill };
    }

    if (query.availability) {
      where.availability = query.availability;
    }

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: EMPLOYEE_DIRECTORY_SELECT,
        orderBy: { fullName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async findOne(id: string, currentUser: AuthenticatedRequestUser) {
    const employee = await this.prisma.user.findUnique({
      where: { id },
      select: EMPLOYEE_PROFILE_SELECT,
    });

    if (!employee) {
      throw new NotFoundException(`Employee "${id}" was not found.`);
    }

    this.assertCanView(employee.id, employee.departmentId, currentUser);

    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`An employee with email "${dto.email}" already exists.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role ?? SystemRole.EMPLOYEE,
        designation: dto.designation,
        skills: dto.skills ?? [],
        departmentId: dto.departmentId,
        capacityHoursPerWeek: dto.capacityHoursPerWeek ?? 40,
      },
      select: EMPLOYEE_PROFILE_SELECT,
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        designation: dto.designation,
        skills: dto.skills,
        availability: dto.availability,
        capacityHoursPerWeek: dto.capacityHoursPerWeek,
        avatarUrl: dto.avatarUrl,
        departmentId: dto.departmentId,
        role: dto.role,
      },
      select: EMPLOYEE_PROFILE_SELECT,
    });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: EMPLOYEE_DIRECTORY_SELECT,
    });
  }

  async getWorkHistory(id: string, currentUser: AuthenticatedRequestUser) {
    const employee = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, departmentId: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee "${id}" was not found.`);
    }

    this.assertCanView(employee.id, employee.departmentId, currentUser);

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - WORK_HISTORY_LOOKBACK_DAYS);

    const [taskAssignments, ownedProjects, recentTimesheetEntries] = await Promise.all([
      this.prisma.taskAssignee.findMany({
        where: { userId: id },
        include: {
          task: {
            include: {
              project: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      }),
      this.prisma.project.findMany({
        where: { ownerId: id },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          healthScore: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.timesheetEntry.findMany({
        where: { employeeId: id, date: { gte: lookbackDate } },
        orderBy: { date: "desc" },
      }),
    ]);

    return {
      assignedTasks: taskAssignments.map(({ task }) => task),
      ownedProjects,
      recentTimesheetEntries,
    };
  }

  private isUnrestricted(currentUser: AuthenticatedRequestUser): boolean {
    return (
      currentUser.role === SystemRole.SUPER_ADMIN || currentUser.role === SystemRole.DEPARTMENT_MANAGER
    );
  }

  private assertCanView(
    employeeId: string,
    employeeDepartmentId: string | null,
    currentUser: AuthenticatedRequestUser,
  ): void {
    if (this.isUnrestricted(currentUser) || employeeId === currentUser.id) {
      return;
    }

    if (employeeDepartmentId && employeeDepartmentId === currentUser.departmentId) {
      return;
    }

    throw new ForbiddenException("You do not have access to this employee's data.");
  }

  private async ensureExists(id: string): Promise<void> {
    const employee = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!employee) {
      throw new NotFoundException(`Employee "${id}" was not found.`);
    }
  }
}
