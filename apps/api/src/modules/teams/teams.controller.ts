import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DepartmentScoped } from "../../common/decorators/department-scope.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { AddTeamMemberDto } from "./dto/add-team-member.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { ListTeamsQueryDto } from "./dto/list-teams-query.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { TeamsService } from "./teams.service";

@Controller("teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedRequestUser, @Query() query: ListTeamsQueryDto) {
    return this.teamsService.findAll(user, query);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.teamsService.findOne(id, user);
  }

  @Get(":id/capacity")
  getCapacity(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.teamsService.getCapacity(id, user);
  }

  @Get(":id/workload")
  getWorkload(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.teamsService.getWorkload(id, user);
  }

  @Post()
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  @DepartmentScoped()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Patch(":id")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.teamsService.update(id, dto, user);
  }

  @Patch(":id/archive")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.teamsService.archive(id, user);
  }

  @Patch(":id/unarchive")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  unarchive(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.teamsService.unarchive(id, user);
  }

  @Post(":id/members")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  addMember(
    @Param("id") id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.teamsService.addMember(id, dto, user);
  }

  @Delete(":id/members/:userId")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.teamsService.removeMember(id, userId, user);
  }
}
