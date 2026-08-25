import { IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
