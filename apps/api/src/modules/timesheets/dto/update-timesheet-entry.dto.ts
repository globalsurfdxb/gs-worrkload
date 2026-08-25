import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateTimesheetEntryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
