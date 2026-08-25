import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DepartmentScoped } from "../../common/decorators/department-scope.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { WorkloadEmployeesQueryDto } from "./dto/workload-employees-query.dto";
import { WorkloadStatusQueryDto } from "./dto/workload-status-query.dto";
import { WorkloadService } from "./workload.service";

@Controller("workload")
export class WorkloadController {
  constructor(private readonly workloadService: WorkloadService) {}

  @Get("employees")
  @DepartmentScoped("departmentId")
  getEmployees(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: WorkloadEmployeesQueryDto,
  ) {
    return this.workloadService.getEmployeeWorkloads(currentUser, query);
  }

  @Get("overloaded")
  @DepartmentScoped("departmentId")
  getOverloaded(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: WorkloadStatusQueryDto,
  ) {
    return this.workloadService.getEmployeesByStatus(currentUser, query.departmentId, "OVERLOADED");
  }

  @Get("underutilized")
  @DepartmentScoped("departmentId")
  getUnderutilized(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Query() query: WorkloadStatusQueryDto,
  ) {
    return this.workloadService.getEmployeesByStatus(currentUser, query.departmentId, "UNDERUTILIZED");
  }

  @Get("teams/:teamId")
  getTeamWorkload(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param("teamId", ParseUUIDPipe) teamId: string,
  ) {
    return this.workloadService.getTeamWorkload(currentUser, teamId);
  }

  @Get("departments/:departmentId")
  @DepartmentScoped("departmentId")
  getDepartmentWorkload(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
  ) {
    return this.workloadService.getDepartmentWorkload(currentUser, departmentId);
  }
}
