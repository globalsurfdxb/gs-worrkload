import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { AddAssigneeDto } from "./dto/add-assignee.dto";
import { AddWatcherDto } from "./dto/add-watcher.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateDependencyDto } from "./dto/create-dependency.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { QueryTasksDto } from "./dto/query-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Query() query: QueryTasksDto) {
    return this.tasksService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasksService.update(id, dto, user.id);
  }

  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.tasksService.remove(id);
  }

  @Post(":id/assignees")
  addAssignee(
    @Param("id") id: string,
    @Body() dto: AddAssigneeDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasksService.addAssignee(id, dto, user.id);
  }

  @Delete(":id/assignees/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAssignee(@Param("id") id: string, @Param("userId") userId: string) {
    return this.tasksService.removeAssignee(id, userId);
  }

  @Post(":id/watchers")
  addWatcher(@Param("id") id: string, @Body() dto: AddWatcherDto) {
    return this.tasksService.addWatcher(id, dto);
  }

  @Delete(":id/watchers/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWatcher(@Param("id") id: string, @Param("userId") userId: string) {
    return this.tasksService.removeWatcher(id, userId);
  }

  @Post(":id/comments")
  addComment(
    @Param("id") id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasksService.addComment(id, dto, user.id);
  }

  @Get(":id/comments")
  getComments(@Param("id") id: string) {
    return this.tasksService.getComments(id);
  }

  @Post(":id/dependencies")
  addDependency(@Param("id") id: string, @Body() dto: CreateDependencyDto) {
    return this.tasksService.addDependency(id, dto);
  }

  @Delete(":id/dependencies/:dependencyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDependency(@Param("id") id: string, @Param("dependencyId") dependencyId: string) {
    return this.tasksService.removeDependency(id, dependencyId);
  }
}
