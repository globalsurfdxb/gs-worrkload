import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DepartmentScopeGuard } from "./common/guards/department-scope.guard";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { WorkloadModule } from "./modules/workload/workload.module";
import { TimesheetsModule } from "./modules/timesheets/timesheets.module";
import { ApprovalsModule } from "./modules/approvals/approvals.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { FilesModule } from "./modules/files/files.module";
import { ReportsModule } from "./modules/reports/reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    DepartmentsModule,
    TeamsModule,
    ProjectsModule,
    TasksModule,
    WorkloadModule,
    TimesheetsModule,
    ApprovalsModule,
    NotificationsModule,
    FilesModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DepartmentScopeGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
