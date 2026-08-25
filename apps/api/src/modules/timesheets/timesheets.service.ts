import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ApprovalStatus,
  ApprovalType,
  Prisma,
  SystemRole,
  TimesheetEntry,
  TimesheetStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateTimesheetEntryDto } from "./dto/create-timesheet-entry.dto";
import { UpdateTimesheetEntryDto } from "./dto/update-timesheet-entry.dto";
import { ListTimesheetEntriesQueryDto } from "./dto/list-timesheet-entries-query.dto";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";

/** Roles that may view/report on timesheet entries beyond their own. */
const PRIVILEGED_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.DEPARTMENT_MANAGER,
  SystemRole.TEAM_LEAD,
];

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedRequestUser, query: ListTimesheetEntriesQueryDto) {
    const isPrivileged = this.isPrivileged(user);

    const where: Prisma.TimesheetEntryWhereInput = {
      // Plain employees (and clients) can never look at anyone else's entries,
      // regardless of what employeeId they pass in the query string.
      employeeId: isPrivileged ? query.employeeId : user.id,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...this.dateRangeFilter(query.dateFrom, query.dateTo),
    };

    return this.prisma.timesheetEntry.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }

  async findOne(id: string, user: AuthenticatedRequestUser): Promise<TimesheetEntry> {
    const entry = await this.getOrThrow(id);
    this.assertViewAccess(entry.employeeId, user);
    return entry;
  }

  async create(user: AuthenticatedRequestUser, dto: CreateTimesheetEntryDto): Promise<TimesheetEntry> {
    return this.prisma.timesheetEntry.create({
      data: {
        employeeId: user.id,
        taskId: dto.taskId,
        projectId: dto.projectId,
        date: new Date(dto.date),
        hours: dto.hours,
        notes: dto.notes,
        status: TimesheetStatus.SUBMITTED,
      },
    });
  }

  async update(
    id: string,
    user: AuthenticatedRequestUser,
    dto: UpdateTimesheetEntryDto,
  ): Promise<TimesheetEntry> {
    const entry = await this.getOrThrow(id);
    this.assertMutable(entry, user);

    return this.prisma.timesheetEntry.update({
      where: { id },
      data: {
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async remove(id: string, user: AuthenticatedRequestUser): Promise<void> {
    const entry = await this.getOrThrow(id);
    this.assertMutable(entry, user);

    await this.prisma.timesheetEntry.delete({ where: { id } });
  }

  async submitForApproval(id: string, user: AuthenticatedRequestUser): Promise<TimesheetEntry> {
    const entry = await this.getOrThrow(id);
    this.assertOwnerOrSuperAdmin(entry.employeeId, user);

    if (entry.status !== TimesheetStatus.SUBMITTED) {
      throw new ConflictException(
        `Timesheet entry ${id} must be in SUBMITTED status to submit for approval (current status: ${entry.status}).`,
      );
    }

    const now = new Date();
    const entityLabel = `Timesheet ${entry.date.toISOString().slice(0, 10)} — ${entry.hours}h`;

    const [updatedEntry] = await this.prisma.$transaction([
      this.prisma.timesheetEntry.update({
        where: { id },
        data: { status: TimesheetStatus.PENDING_APPROVAL },
      }),
      this.prisma.approvalRequest.create({
        data: {
          type: ApprovalType.TIMESHEET,
          status: ApprovalStatus.SUBMITTED,
          requesterId: entry.employeeId,
          entityLabel,
          timesheetEntryId: entry.id,
          submittedAt: now,
        },
      }),
    ]);

    return updatedEntry;
  }

  async employeeReport(
    employeeId: string,
    user: AuthenticatedRequestUser,
    query: DateRangeQueryDto,
  ) {
    this.assertViewAccess(employeeId, user);

    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        employeeId,
        ...this.dateRangeFilter(query.dateFrom, query.dateTo),
      },
      orderBy: { date: "asc" },
    });

    return this.summarize(entries);
  }

  async teamReport(teamId: string, query: DateRangeQueryDto) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });

    const entries = await this.entriesForEmployees(
      members.map((member) => member.userId),
      query,
    );

    return this.summarize(entries);
  }

  async departmentReport(departmentId: string, query: DateRangeQueryDto) {
    const employees = await this.prisma.user.findMany({
      where: { departmentId },
      select: { id: true },
    });

    const entries = await this.entriesForEmployees(employees.map((employee) => employee.id), query);

    return this.summarize(entries);
  }

  async projectReport(projectId: string, query: DateRangeQueryDto) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        projectId,
        ...this.dateRangeFilter(query.dateFrom, query.dateTo),
      },
      orderBy: { date: "asc" },
    });

    return this.summarize(entries);
  }

  private async entriesForEmployees(
    employeeIds: string[],
    query: DateRangeQueryDto,
  ): Promise<TimesheetEntry[]> {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.timesheetEntry.findMany({
      where: {
        employeeId: { in: employeeIds },
        ...this.dateRangeFilter(query.dateFrom, query.dateTo),
      },
      orderBy: { date: "asc" },
    });
  }

  private summarize(entries: TimesheetEntry[]) {
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    return { totalHours, entries };
  }

  private dateRangeFilter(dateFrom?: string, dateTo?: string): Prisma.TimesheetEntryWhereInput {
    if (!dateFrom && !dateTo) {
      return {};
    }
    return {
      date: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      },
    };
  }

  private isPrivileged(user: AuthenticatedRequestUser): boolean {
    return PRIVILEGED_ROLES.includes(user.role);
  }

  /** Managers/leads/admins may view any entry; everyone else only their own. */
  private assertViewAccess(employeeId: string, user: AuthenticatedRequestUser): void {
    if (!this.isPrivileged(user) && user.id !== employeeId) {
      throw new ForbiddenException("You do not have access to this timesheet entry.");
    }
  }

  /** Only the owning employee or a SUPER_ADMIN may mutate/submit an entry. */
  private assertOwnerOrSuperAdmin(employeeId: string, user: AuthenticatedRequestUser): void {
    if (employeeId !== user.id && user.role !== SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException("You do not have access to modify this timesheet entry.");
    }
  }

  private assertMutable(entry: TimesheetEntry, user: AuthenticatedRequestUser): void {
    this.assertOwnerOrSuperAdmin(entry.employeeId, user);

    if (entry.status !== TimesheetStatus.SUBMITTED) {
      throw new ForbiddenException(
        `Timesheet entry ${entry.id} can no longer be edited (current status: ${entry.status}).`,
      );
    }
  }

  private async getOrThrow(id: string): Promise<TimesheetEntry> {
    const entry = await this.prisma.timesheetEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Timesheet entry ${id} not found.`);
    }
    return entry;
  }
}
