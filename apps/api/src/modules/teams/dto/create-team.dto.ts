import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { ProjectMethodology } from "@prisma/client";

export class CreateTeamDto {
  @IsUUID()
  departmentId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, {
    message: "code must contain only uppercase letters, numbers, - and _",
  })
  code!: string;

  @IsOptional()
  @IsUUID()
  teamLeadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  capacityHoursPerWeek?: number = 40;

  @IsOptional()
  @IsEnum(ProjectMethodology)
  methodology?: ProjectMethodology;
}
