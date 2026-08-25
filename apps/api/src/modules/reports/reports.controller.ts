import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateKpiSnapshotDto } from "./dto/create-kpi-snapshot.dto";
import { QueryKpisDto } from "./dto/query-kpis.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("company")
  @Roles(SystemRole.SUPER_ADMIN)
  getCompanyReport() {
    return this.reportsService.getCompanyReport();
  }

  @Get("departments/:id")
  getDepartmentReport(@Param("id") id: string) {
    return this.reportsService.getDepartmentReport(id);
  }

  @Get("teams/:id")
  getTeamReport(@Param("id") id: string) {
    return this.reportsService.getTeamReport(id);
  }

  @Get("kpis")
  getKpis(@Query() query: QueryKpisDto) {
    return this.reportsService.getKpis(query);
  }

  @Post("kpis/snapshot")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  createKpiSnapshot(@Body() dto: CreateKpiSnapshotDto) {
    return this.reportsService.createKpiSnapshot(dto);
  }
}
