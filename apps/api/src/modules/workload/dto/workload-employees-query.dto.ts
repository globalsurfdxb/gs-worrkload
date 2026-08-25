import { IsOptional, IsUUID } from "class-validator";

export class WorkloadEmployeesQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
