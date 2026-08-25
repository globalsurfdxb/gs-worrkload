import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Priority, TaskStatus } from "@prisma/client";

export class QueryTasksDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  /** Pass "null" to fetch only top-level (non-subtask) tasks. */
  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsISO8601()
  dueBefore?: string;

  @IsOptional()
  @IsISO8601()
  dueAfter?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
