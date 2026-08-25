import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateTimesheetEntryDto } from "./dto/create-timesheet-entry.dto";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";
import { ListTimesheetEntriesQueryDto } from "./dto/list-timesheet-entries-query.dto";
import { UpdateTimesheetEntryDto } from "./dto/update-timesheet-entry.dto";
import { TimesheetsService } from "./timesheets.service";

@Controller("timesheets")
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListTimesheetEntriesQueryDto,
  ) {
    return this.timesheetsService.findAll(user, query);
  }

  @Get("reports/employee/:employeeId")
  getEmployeeReport(
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.timesheetsService.employeeReport(employeeId, user, query);
  }

  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  @Get("reports/team/:teamId")
  getTeamReport(@Param("teamId", ParseUUIDPipe) teamId: string, @Query() query: DateRangeQueryDto) {
    return this.timesheetsService.teamReport(teamId, query);
  }

  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  @Get("reports/department/:departmentId")
  getDepartmentReport(
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.timesheetsService.departmentReport(departmentId, query);
  }

  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  @Get("reports/project/:projectId")
  getProjectReport(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.timesheetsService.projectReport(projectId, query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.timesheetsService.findOne(id, user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateTimesheetEntryDto,
  ) {
    return this.timesheetsService.create(user, dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateTimesheetEntryDto,
  ) {
    return this.timesheetsService.update(id, user, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.timesheetsService.remove(id, user);
  }

  @Post(":id/submit-for-approval")
  submitForApproval(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.timesheetsService.submitForApproval(id, user);
  }
}
