import { IsOptional, IsUUID } from "class-validator";

export class WorkloadStatusQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
