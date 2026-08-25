import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DepartmentScoped } from "../../common/decorators/department-scope.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { CreateProjectDto } from "./dto/create-project.dto";
import { CreateProjectFromTemplateDto } from "./dto/create-project-from-template.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: ListProjectsQueryDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.projectsService.findAll(query, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.projectsService.findOne(id, user);
  }

  @Post()
  @DepartmentScoped()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Post("from-template/:templateId")
  @DepartmentScoped()
  createFromTemplate(
    @Param("templateId") templateId: string,
    @Body() dto: CreateProjectFromTemplateDto,
  ) {
    return this.projectsService.createFromTemplate(templateId, dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.projectsService.remove(id, user);
  }

  @Get(":id/health")
  getHealth(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.projectsService.getHealth(id, user);
  }

  @Get(":id/milestones")
  listMilestones(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.projectsService.listMilestones(id, user);
  }

  @Post(":id/milestones")
  createMilestone(
    @Param("id") id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.projectsService.createMilestone(id, dto, user);
  }

  @Patch(":id/milestones/:milestoneId")
  updateMilestone(
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.projectsService.updateMilestone(id, milestoneId, dto, user);
  }

  @Delete(":id/milestones/:milestoneId")
  deleteMilestone(
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.projectsService.deleteMilestone(id, milestoneId, user);
  }
}
