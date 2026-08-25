import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class CreateTimesheetEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
