import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";
import { ProjectMethodology } from "@prisma/client";

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  teamLeadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  capacityHoursPerWeek?: number;

  @IsOptional()
  @IsEnum(ProjectMethodology)
  methodology?: ProjectMethodology;
}
