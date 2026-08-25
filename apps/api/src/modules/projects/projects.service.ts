import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Priority, ProjectStatus, SystemRole, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { CreateProjectDto } from "./dto/create-project.dto";
import { CreateProjectFromTemplateDto } from "./dto/create-project-from-template.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

const ALL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.TESTING,
  TaskStatus.COMPLETED,
];

const HEALTH_PENALTY_PER_OVERDUE_TASK = 5;

interface DefaultMilestoneEntry {
  name: string;
  offsetDays?: number;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListProjectsQueryDto, user: AuthenticatedRequestUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProjectWhereInput = {};

    // Non-SUPER_ADMIN callers are always confined to their own department,
    // regardless of what (if anything) they passed in the departmentId filter.
    if (user.role !== SystemRole.SUPER_ADMIN) {
      where.departmentId = user.departmentId ?? "__no_department__";
    } else if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.teamId) where.teamId = query.teamId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: { _count: { select: { tasks: true, milestones: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: string, user: AuthenticatedRequestUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        department: true,
        team: true,
        owner: true,
        milestones: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found.`);
    }

    this.assertDepartmentAccess(project.departmentId, user);

    const taskCounts = await this.prisma.task.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: true,
    });

    const tasksByStatus = ALL_TASK_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<TaskStatus, number>,
    );
    for (const row of taskCounts) {
      tasksByStatus[row.status] = row._count;
    }

    return { ...project, tasksByStatus };
  }

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        departmentId: dto.departmentId,
        teamId: dto.teamId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? ProjectStatus.PLANNING,
        priority: dto.priority ?? Priority.MEDIUM,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ownerId: dto.ownerId,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(id);
    this.assertDepartmentAccess(project.departmentId, user);

    return this.prisma.project.update({
      where: { id },
      data: {
        departmentId: dto.departmentId,
        teamId: dto.teamId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ownerId: dto.ownerId,
      },
    });
  }

  async remove(id: string, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(id);
    this.assertDepartmentAccess(project.departmentId, user);

    // Soft delete: projects are never hard-deleted, only cancelled.
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.CANCELLED },
    });
  }

  async getHealth(id: string, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(id);
    this.assertDepartmentAccess(project.departmentId, user);

    const now = new Date();
    const [overdueTaskCount, totalTaskCount] = await this.prisma.$transaction([
      this.prisma.task.count({
        where: {
          projectId: id,
          dueDate: { lt: now },
          status: { not: TaskStatus.COMPLETED },
        },
      }),
      this.prisma.task.count({ where: { projectId: id } }),
    ]);

    const healthScore = Math.max(0, 100 - overdueTaskCount * HEALTH_PENALTY_PER_OVERDUE_TASK);

    await this.prisma.project.update({
      where: { id },
      data: { healthScore },
    });

    return { healthScore, overdueTaskCount, totalTaskCount };
  }

  async listMilestones(projectId: string, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(projectId);
    this.assertDepartmentAccess(project.departmentId, user);

    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: "asc" },
    });
  }

  async createMilestone(projectId: string, dto: CreateMilestoneDto, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(projectId);
    this.assertDepartmentAccess(project.departmentId, user);

    return this.prisma.milestone.create({
      data: {
        projectId,
        name: dto.name,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    user: AuthenticatedRequestUser,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    this.assertDepartmentAccess(project.departmentId, user);
    await this.getMilestoneOrThrow(projectId, milestoneId);

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        name: dto.name,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        isCompleted: dto.isCompleted,
      },
    });
  }

  async deleteMilestone(projectId: string, milestoneId: string, user: AuthenticatedRequestUser) {
    const project = await this.getProjectOrThrow(projectId);
    this.assertDepartmentAccess(project.departmentId, user);
    await this.getMilestoneOrThrow(projectId, milestoneId);

    await this.prisma.milestone.delete({ where: { id: milestoneId } });
  }

  async createFromTemplate(templateId: string, dto: CreateProjectFromTemplateDto) {
    const template = await this.prisma.projectTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Project template ${templateId} not found.`);
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const milestoneDefs = Array.isArray(template.defaultMilestones)
      ? (template.defaultMilestones as unknown as DefaultMilestoneEntry[])
      : [];

    const project = await this.prisma.project.create({
      data: {
        departmentId: dto.departmentId,
        teamId: dto.teamId,
        name: dto.name,
        status: ProjectStatus.PLANNING,
        startDate,
        ownerId: dto.ownerId,
      },
    });

    if (milestoneDefs.length > 0) {
      await this.prisma.milestone.createMany({
        data: milestoneDefs.map((entry) => ({
          projectId: project.id,
          name: entry.name,
          dueDate:
            typeof entry.offsetDays === "number"
              ? new Date(startDate.getTime() + entry.offsetDays * 24 * 60 * 60 * 1000)
              : undefined,
        })),
      });
    }

    return this.prisma.project.findUnique({
      where: { id: project.id },
      include: { milestones: true },
    });
  }

  private async getProjectOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found.`);
    }
    return project;
  }

  private async getMilestoneOrThrow(projectId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.projectId !== projectId) {
      throw new NotFoundException(`Milestone ${milestoneId} not found on project ${projectId}.`);
    }
    return milestone;
  }

  private assertDepartmentAccess(departmentId: string, user: AuthenticatedRequestUser): void {
    if (user.role !== SystemRole.SUPER_ADMIN && departmentId !== user.departmentId) {
      throw new ForbiddenException("You do not have access to this department's data.");
    }
  }
}
