import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query() query: QueryEmployeesDto, @CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.employeesService.findAll(query, currentUser);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.employeesService.findOne(id, currentUser);
  }

  @Get(":id/work-history")
  getWorkHistory(@Param("id") id: string, @CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.employeesService.getWorkHistory(id, currentUser);
  }

  @Post()
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(":id")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(":id")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  deactivate(@Param("id") id: string) {
    return this.employeesService.deactivate(id);
  }
}
