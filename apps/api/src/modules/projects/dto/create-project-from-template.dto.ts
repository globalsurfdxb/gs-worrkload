import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateProjectFromTemplateDto {
  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;
}
