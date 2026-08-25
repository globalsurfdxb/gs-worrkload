import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DepartmentScoped } from "../../common/decorators/department-scope.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { ListDepartmentsQueryDto } from "./dto/list-departments-query.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(
    @Query() query: ListDepartmentsQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.departmentsService.findAll(user, query.includeArchived ?? false);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.departmentsService.findOne(id, user);
  }

  @Post()
  @Roles(SystemRole.SUPER_ADMIN)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(":id")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  @DepartmentScoped("id")
  update(@Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Patch(":id/archive")
  @Roles(SystemRole.SUPER_ADMIN)
  archive(@Param("id") id: string) {
    return this.departmentsService.setArchived(id, true);
  }

  @Patch(":id/unarchive")
  @Roles(SystemRole.SUPER_ADMIN)
  unarchive(@Param("id") id: string) {
    return this.departmentsService.setArchived(id, false);
  }

  @Get(":id/resource-allocation")
  getResourceAllocation(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.departmentsService.getResourceAllocation(id, user);
  }

  @Get(":id/kpis")
  getKpis(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.departmentsService.getKpis(id, user);
  }
}
