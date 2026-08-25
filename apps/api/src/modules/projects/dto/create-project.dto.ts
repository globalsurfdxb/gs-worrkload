import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { Priority, ProjectStatus } from "@prisma/client";

export class CreateProjectDto {
  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsUUID()
  ownerId!: string;
}
