import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
  Prisma,
  SystemRole,
  TimesheetStatus,
} from "@prisma/client";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateApprovalDto } from "./dto/create-approval.dto";
import { ListApprovalsQueryDto } from "./dto/list-approvals-query.dto";

// Roles that can act as an approver and see approval requests beyond their own.
const APPROVER_ROLES: SystemRole[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.DEPARTMENT_MANAGER,
  SystemRole.TEAM_LEAD,
];

const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const APPROVAL_INCLUDE = {
  requester: { select: USER_SUMMARY_SELECT },
  approver: { select: USER_SUMMARY_SELECT },
  project: { select: { id: true, name: true } },
  timesheetEntry: true,
} satisfies Prisma.ApprovalRequestInclude;

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListApprovalsQueryDto, user: AuthenticatedRequestUser) {
    const isApprover = APPROVER_ROLES.includes(user.role);

    const where: Prisma.ApprovalRequestWhereInput = {
      ...(query.type ? { type: query.type } : {}),
    };

    if (!isApprover) {
      // EMPLOYEE (and any other non-approver role) can only ever see their own requests.
      where.requesterId = user.id;
      if (query.status) where.status = query.status;
    } else if (query.pendingForMe) {
      where.status = { in: [ApprovalStatus.SUBMITTED, ApprovalStatus.PENDING] };
      where.OR = [{ approverId: user.id }, { approverId: null }];
      if (query.requesterId) where.requesterId = query.requesterId;
    } else {
      if (query.requesterId) where.requesterId = query.requesterId;
      if (query.approverId) where.approverId = query.approverId;
      if (query.status) where.status = query.status;
    }

    return this.prisma.approvalRequest.findMany({
      where,
      include: APPROVAL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: AuthenticatedRequestUser) {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: APPROVAL_INCLUDE,
    });

    if (!approval) {
      throw new NotFoundException(`Approval request ${id} not found.`);
    }

    this.assertReadAccess(approval, user);

    return approval;
  }

  async create(dto: CreateApprovalDto, user: AuthenticatedRequestUser) {
    if (dto.type === ApprovalType.TIMESHEET) {
      throw new BadRequestException(
        "TIMESHEET approvals are created automatically when a timesheet entry is submitted. Use POST /timesheets/:id/submit-for-approval instead.",
      );
    }

    if (dto.type === ApprovalType.PROJECT && !dto.projectId) {
      throw new BadRequestException("projectId is required when type is PROJECT.");
    }

    return this.prisma.approvalRequest.create({
      data: {
        type: dto.type,
        status: ApprovalStatus.SUBMITTED,
        requesterId: user.id,
        entityLabel: dto.entityLabel,
        projectId: dto.type === ApprovalType.PROJECT ? dto.projectId : undefined,
        comment: dto.comment,
        submittedAt: new Date(),
      },
      include: APPROVAL_INCLUDE,
    });
  }

  async approve(id: string, comment: string | undefined, user: AuthenticatedRequestUser) {
    return this.decide(id, ApprovalStatus.APPROVED, comment, user);
  }

  async reject(id: string, comment: string, user: AuthenticatedRequestUser) {
    return this.decide(id, ApprovalStatus.REJECTED, comment, user);
  }

  private async decide(
    id: string,
    status: typeof ApprovalStatus.APPROVED | typeof ApprovalStatus.REJECTED,
    comment: string | undefined,
    user: AuthenticatedRequestUser,
  ) {
    const approval = await this.getOrThrow(id);

    if (approval.status === ApprovalStatus.APPROVED || approval.status === ApprovalStatus.REJECTED) {
      throw new ConflictException(`Approval request ${id} has already been decided.`);
    }

    const decidedAt = new Date();
    const linkedTimesheetStatus =
      status === ApprovalStatus.APPROVED ? TimesheetStatus.APPROVED : TimesheetStatus.REJECTED;

    const approvalUpdate = this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status,
        approverId: user.id,
        decidedAt,
        ...(comment !== undefined ? { comment } : {}),
      },
      include: APPROVAL_INCLUDE,
    });

    if (approval.timesheetEntryId) {
      const timesheetUpdate = this.prisma.timesheetEntry.update({
        where: { id: approval.timesheetEntryId },
        data: { status: linkedTimesheetStatus },
      });
      const [updated] = await this.prisma.$transaction([approvalUpdate, timesheetUpdate]);
      return updated;
    }

    const [updated] = await this.prisma.$transaction([approvalUpdate]);
    return updated;
  }

  private async getOrThrow(id: string): Promise<ApprovalRequest> {
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) {
      throw new NotFoundException(`Approval request ${id} not found.`);
    }
    return approval;
  }

  private assertReadAccess(
    approval: { requesterId: string },
    user: AuthenticatedRequestUser,
  ): void {
    const isApprover = APPROVER_ROLES.includes(user.role);
    if (!isApprover && approval.requesterId !== user.id) {
      throw new ForbiddenException("You do not have access to this approval request.");
    }
  }
}
