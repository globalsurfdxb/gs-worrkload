import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AddAssigneeDto } from "./dto/add-assignee.dto";
import { AddWatcherDto } from "./dto/add-watcher.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateDependencyDto } from "./dto/create-dependency.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { QueryTasksDto } from "./dto/query-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTasksDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.TaskWhereInput = {};

    if (query.projectId) where.projectId = query.projectId;
    if (query.milestoneId) where.milestoneId = query.milestoneId;
    if (query.parentTaskId !== undefined) {
      where.parentTaskId = query.parentTaskId === "null" ? null : query.parentTaskId;
    }
    if (query.assigneeId) {
      where.assignees = { some: { userId: query.assigneeId } };
    }
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.dueBefore || query.dueAfter) {
      where.dueDate = {
        ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
        ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
      };
    }
    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          assignees: {
            include: { user: { select: USER_SUMMARY_SELECT } },
          },
          _count: { select: { watchers: true, subtasks: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map(({ _count, ...task }) => ({
        ...task,
        watchersCount: _count.watchers,
        subtasksCount: _count.subtasks,
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        milestone: true,
        parentTask: true,
        subtasks: true,
        assignees: { include: { user: { select: USER_SUMMARY_SELECT } } },
        watchers: { include: { user: { select: USER_SUMMARY_SELECT } } },
        comments: {
          include: { author: { select: USER_SUMMARY_SELECT } },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        dependenciesFrom: {
          include: { prerequisiteTask: true },
        },
        dependenciesTo: {
          include: { dependentTask: true },
        },
        activityEntries: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found.`);
    }

    const { dependenciesFrom, dependenciesTo, ...rest } = task;

    return {
      ...rest,
      dependsOn: dependenciesFrom,
      dependedOnBy: dependenciesTo,
    };
  }

  async create(dto: CreateTaskDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: dto.projectId,
          milestoneId: dto.milestoneId,
          parentTaskId: dto.parentTaskId,
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          estimatedHours: dto.estimatedHours,
          isRecurring: dto.isRecurring,
          recurrenceRule: dto.recurrenceRule,
        },
      });

      if (dto.assigneeIds?.length) {
        await tx.taskAssignee.createMany({
          data: dto.assigneeIds.map((userId) => ({ taskId: task.id, userId })),
          skipDuplicates: true,
        });
      }

      if (dto.watcherIds?.length) {
        await tx.taskWatcher.createMany({
          data: dto.watcherIds.map((userId) => ({ taskId: task.id, userId })),
          skipDuplicates: true,
        });
      }

      return task;
    });

    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string) {
    const current = await this.prisma.task.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Task ${id} not found.`);
    }

    if (dto.parentTaskId === id) {
      throw new ConflictException("A task cannot be its own parent.");
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.projectId !== undefined) data.project = { connect: { id: dto.projectId } };
    if (dto.milestoneId !== undefined) {
      data.milestone = dto.milestoneId ? { connect: { id: dto.milestoneId } } : { disconnect: true };
    }
    if (dto.parentTaskId !== undefined) {
      data.parentTask = dto.parentTaskId ? { connect: { id: dto.parentTaskId } } : { disconnect: true };
    }
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.estimatedHours !== undefined) data.estimatedHours = dto.estimatedHours;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;

    const activityEntries: Prisma.ActivityLogEntryCreateManyInput[] = [];
    const pushIfChanged = (field: string, oldValue: unknown, newValue: unknown) => {
      if (oldValue === newValue) return;
      activityEntries.push({
        taskId: id,
        actorId,
        field,
        oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
        newValue: newValue === null || newValue === undefined ? null : String(newValue),
      });
    };

    if (dto.status !== undefined) {
      pushIfChanged("status", current.status, dto.status);
    }
    if (dto.priority !== undefined) {
      pushIfChanged("priority", current.priority, dto.priority);
    }
    if (dto.dueDate !== undefined) {
      const newDueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      const oldTime = current.dueDate?.getTime() ?? null;
      const newTime = newDueDate?.getTime() ?? null;
      if (oldTime !== newTime) {
        activityEntries.push({
          taskId: id,
          actorId,
          field: "dueDate",
          oldValue: current.dueDate ? String(current.dueDate) : null,
          newValue: newDueDate ? String(newDueDate) : null,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data });
      if (activityEntries.length) {
        await tx.activityLogEntry.createMany({ data: activityEntries });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { _count: { select: { subtasks: true } } },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found.`);
    }

    if (task._count.subtasks > 0) {
      throw new ConflictException(
        "This task has subtasks. Delete or reparent them before deleting this task.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.taskAssignee.deleteMany({ where: { taskId: id } }),
      this.prisma.taskWatcher.deleteMany({ where: { taskId: id } }),
      this.prisma.comment.deleteMany({ where: { taskId: id } }),
      this.prisma.activityLogEntry.deleteMany({ where: { taskId: id } }),
      this.prisma.taskDependency.deleteMany({
        where: { OR: [{ dependentTaskId: id }, { prerequisiteTaskId: id }] },
      }),
      this.prisma.task.delete({ where: { id } }),
    ]);
  }

  async addAssignee(taskId: string, dto: AddAssigneeDto, actorId: string) {
    await this.ensureTaskExists(taskId);

    const existing = await this.prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException("This user is already assigned to the task.");
    }

    const [assignee] = await this.prisma.$transaction([
      this.prisma.taskAssignee.create({
        data: { taskId, userId: dto.userId },
        include: { user: { select: USER_SUMMARY_SELECT } },
      }),
      this.prisma.activityLogEntry.create({
        data: { taskId, actorId, field: "assignee", newValue: dto.userId },
      }),
    ]);

    return assignee;
  }

  async removeAssignee(taskId: string, userId: string) {
    const existing = await this.prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    if (!existing) {
      throw new NotFoundException("This user is not assigned to the task.");
    }

    await this.prisma.taskAssignee.delete({ where: { id: existing.id } });
  }

  async addWatcher(taskId: string, dto: AddWatcherDto) {
    await this.ensureTaskExists(taskId);

    const existing = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException("This user is already watching the task.");
    }

    return this.prisma.taskWatcher.create({
      data: { taskId, userId: dto.userId },
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
  }

  async removeWatcher(taskId: string, userId: string) {
    const existing = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    if (!existing) {
      throw new NotFoundException("This user is not watching the task.");
    }

    await this.prisma.taskWatcher.delete({ where: { id: existing.id } });
  }

  async addComment(taskId: string, dto: CreateCommentDto, authorId: string) {
    await this.ensureTaskExists(taskId);

    return this.prisma.comment.create({
      data: { taskId, authorId, body: dto.body },
      include: { author: { select: USER_SUMMARY_SELECT } },
    });
  }

  async getComments(taskId: string) {
    await this.ensureTaskExists(taskId);

    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: "asc" },
    });
  }

  async addDependency(taskId: string, dto: CreateDependencyDto) {
    if (taskId === dto.prerequisiteTaskId) {
      throw new ConflictException("A task cannot depend on itself.");
    }

    await this.ensureTaskExists(taskId);
    await this.ensureTaskExists(dto.prerequisiteTaskId);

    const [existing, reverse] = await Promise.all([
      this.prisma.taskDependency.findUnique({
        where: {
          dependentTaskId_prerequisiteTaskId: {
            dependentTaskId: taskId,
            prerequisiteTaskId: dto.prerequisiteTaskId,
          },
        },
      }),
      this.prisma.taskDependency.findUnique({
        where: {
          dependentTaskId_prerequisiteTaskId: {
            dependentTaskId: dto.prerequisiteTaskId,
            prerequisiteTaskId: taskId,
          },
        },
      }),
    ]);

    if (existing) {
      throw new ConflictException("This dependency already exists.");
    }
    if (reverse) {
      throw new ConflictException(
        "This would create a circular dependency: the prerequisite task already depends on this task.",
      );
    }

    return this.prisma.taskDependency.create({
      data: { dependentTaskId: taskId, prerequisiteTaskId: dto.prerequisiteTaskId },
      include: { prerequisiteTask: true },
    });
  }

  async removeDependency(taskId: string, dependencyId: string) {
    const existing = await this.prisma.taskDependency.findFirst({
      where: { id: dependencyId, dependentTaskId: taskId },
    });
    if (!existing) {
      throw new NotFoundException("Dependency not found on this task.");
    }

    await this.prisma.taskDependency.delete({ where: { id: dependencyId } });
  }

  private async ensureTaskExists(taskId: string): Promise<void> {
    const exists = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Task ${taskId} not found.`);
    }
  }
}
