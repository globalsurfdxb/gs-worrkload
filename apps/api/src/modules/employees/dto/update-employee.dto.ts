import { EmployeeAvailability, SystemRole } from "@prisma/client";
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsEnum(EmployeeAvailability)
  availability?: EmployeeAvailability;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacityHoursPerWeek?: number;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(SystemRole)
  role?: SystemRole;
}
