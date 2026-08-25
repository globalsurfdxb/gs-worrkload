import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectMethodology, ProjectStatus, SystemRole, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { AddTeamMemberDto } from "./dto/add-team-member.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { ListTeamsQueryDto } from "./dto/list-teams-query.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";

const TEAM_LEAD_SELECT = { id: true, fullName: true, email: true, designation: true } as const;
const DEPARTMENT_SELECT = { id: true, name: true, code: true } as const;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedRequestUser, query: ListTeamsQueryDto) {
    const conditions: Prisma.TeamWhereInput[] = [];

    if (!query.includeArchived) {
      conditions.push({ isArchived: false });
    }

    if (query.departmentId) {
      conditions.push({ departmentId: query.departmentId });
    }

    if (user.role !== SystemRole.SUPER_ADMIN && user.role !== SystemRole.DEPARTMENT_MANAGER) {
      const visibility: Prisma.TeamWhereInput[] = [];
      if (user.departmentId) {
        visibility.push({ departmentId: user.departmentId });
      }
      if (user.teamIds.length > 0) {
        visibility.push({ id: { in: user.teamIds } });
      }
      // No visible department/team -> force an empty result set instead of leaking data.
      conditions.push(visibility.length > 0 ? { OR: visibility } : { id: { in: [] } });
    }

    return this.prisma.team.findMany({
      where: conditions.length > 0 ? { AND: conditions } : undefined,
      include: {
        department: { select: DEPARTMENT_SELECT },
        teamLead: { select: TEAM_LEAD_SELECT },
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        department: { select: DEPARTMENT_SELECT },
        teamLead: { select: TEAM_LEAD_SELECT },
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true, designation: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        projects: {
          where: { status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] } },
          select: { id: true, name: true, status: true, priority: true, dueDate: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertVisible(team, user);

    const { members, projects, ...rest } = team;

    return {
      ...rest,
      members: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        joinedAt: member.joinedAt,
        fullName: member.user.fullName,
        email: member.user.email,
        designation: member.user.designation,
      })),
      activeProjects: projects,
      memberCount: members.length,
    };
  }

  async create(dto: CreateTeamDto) {
    const [department, teamLead] = await Promise.all([
      this.prisma.department.findUnique({ where: { id: dto.departmentId } }),
      dto.teamLeadId ? this.prisma.user.findUnique({ where: { id: dto.teamLeadId } }) : null,
    ]);

    if (!department) {
      throw new NotFoundException("Department not found.");
    }
    if (dto.teamLeadId && !teamLead) {
      throw new NotFoundException("Team lead user not found.");
    }

    try {
      return await this.prisma.team.create({
        data: {
          departmentId: dto.departmentId,
          name: dto.name,
          code: dto.code,
          teamLeadId: dto.teamLeadId,
          capacityHoursPerWeek: dto.capacityHoursPerWeek ?? 40,
          methodology: dto.methodology ?? ProjectMethodology.AGILE,
        },
      });
    } catch (error) {
      this.rethrowAsConflict(error, "A team with this code already exists.");
    }
  }

  async update(id: string, dto: UpdateTeamDto, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertManageable(team, user, { allowTeamLead: true });

    if (dto.teamLeadId) {
      const teamLead = await this.prisma.user.findUnique({ where: { id: dto.teamLeadId } });
      if (!teamLead) {
        throw new NotFoundException("Team lead user not found.");
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        teamLeadId: dto.teamLeadId,
        capacityHoursPerWeek: dto.capacityHoursPerWeek,
        methodology: dto.methodology,
      },
    });
  }

  async archive(id: string, user: AuthenticatedRequestUser) {
    return this.setArchived(id, true, user);
  }

  async unarchive(id: string, user: AuthenticatedRequestUser) {
    return this.setArchived(id, false, user);
  }

  async addMember(id: string, dto: AddTeamMemberDto, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertManageable(team, user, { allowTeamLead: true });

    const member = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!member) {
      throw new NotFoundException("User not found.");
    }

    try {
      return await this.prisma.teamMember.create({
        data: { teamId: id, userId: dto.userId },
      });
    } catch (error) {
      this.rethrowAsConflict(error, "User is already a member of this team.");
    }
  }

  async removeMember(id: string, userId: string, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertManageable(team, user, { allowTeamLead: true });

    try {
      await this.prisma.teamMember.delete({
        where: { teamId_userId: { teamId: id, userId } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundException("This user is not a member of the team.");
      }
      throw error;
    }
  }

  async getCapacity(id: string, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertVisible(team, user);

    const memberCount = team._count.members;
    const capacityPerMember = memberCount > 0 ? team.capacityHoursPerWeek / memberCount : 0;

    return {
      capacityHoursPerWeek: team.capacityHoursPerWeek,
      memberCount,
      capacityPerMember,
    };
  }

  async getWorkload(id: string, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullName: true, capacityHoursPerWeek: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertVisible(team, user);

    if (team.members.length === 0) {
      return [];
    }

    const memberIds = team.members.map((member) => member.userId);

    // Workload spans ALL projects, not just this team's — a person can be
    // assigned to tasks outside their home team.
    const assignments = await this.prisma.taskAssignee.findMany({
      where: {
        userId: { in: memberIds },
        task: { status: { not: TaskStatus.COMPLETED } },
      },
      select: {
        userId: true,
        task: {
          select: {
            estimatedHours: true,
            _count: { select: { assignees: true } },
          },
        },
      },
    });

    const allocatedByUser = new Map<string, number>();
    for (const assignment of assignments) {
      const totalAssignees = assignment.task._count.assignees || 1;
      const share = (assignment.task.estimatedHours ?? 0) / totalAssignees;
      allocatedByUser.set(assignment.userId, (allocatedByUser.get(assignment.userId) ?? 0) + share);
    }

    return team.members.map((member) => {
      const allocatedHours = Math.round((allocatedByUser.get(member.userId) ?? 0) * 100) / 100;
      const capacityHoursPerWeek = member.user.capacityHoursPerWeek;
      const utilizationPct =
        capacityHoursPerWeek > 0 ? Math.round((allocatedHours / capacityHoursPerWeek) * 1000) / 10 : 0;

      return {
        userId: member.userId,
        fullName: member.user.fullName,
        allocatedHours,
        capacityHoursPerWeek,
        utilizationPct,
      };
    });
  }

  private async setArchived(id: string, isArchived: boolean, user: AuthenticatedRequestUser) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }

    this.assertManageable(team, user, { allowTeamLead: false });

    return this.prisma.team.update({ where: { id }, data: { isArchived } });
  }

  /** Read-access check shared by detail/capacity/workload endpoints. */
  private assertVisible(
    team: { id: string; departmentId: string },
    user: AuthenticatedRequestUser,
  ): void {
    if (user.role === SystemRole.SUPER_ADMIN || user.role === SystemRole.DEPARTMENT_MANAGER) {
      return;
    }

    const inOwnDepartment = team.departmentId === user.departmentId;
    const isTeamMember = user.teamIds.includes(team.id);

    if (!inOwnDepartment && !isTeamMember) {
      throw new ForbiddenException("You do not have access to this team.");
    }
  }

  /** Write-access check shared by update/archive/member-mutation endpoints. */
  private assertManageable(
    team: { id: string; departmentId: string; teamLeadId: string | null },
    user: AuthenticatedRequestUser,
    { allowTeamLead }: { allowTeamLead: boolean },
  ): void {
    if (user.role === SystemRole.SUPER_ADMIN) {
      return;
    }

    if (user.role === SystemRole.DEPARTMENT_MANAGER) {
      if (team.departmentId !== user.departmentId) {
        throw new ForbiddenException("You do not have access to this team's department.");
      }
      return;
    }

    if (allowTeamLead && user.role === SystemRole.TEAM_LEAD && team.teamLeadId === user.id) {
      return;
    }

    throw new ForbiddenException("You do not have permission to manage this team.");
  }

  private rethrowAsConflict(error: unknown, conflictMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException(conflictMessage);
    }
    throw error;
  }
}
