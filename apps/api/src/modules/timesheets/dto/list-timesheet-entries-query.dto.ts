import { TimesheetStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export class ListTimesheetEntriesQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(TimesheetStatus)
  status?: TimesheetStatus;
}
