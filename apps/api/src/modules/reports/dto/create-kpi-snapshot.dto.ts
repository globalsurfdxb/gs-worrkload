import { IsOptional, IsUUID } from "class-validator";

/**
 * Exactly one of departmentId / teamId must be supplied — enforced in
 * ReportsService.createKpiSnapshot (a cross-field rule, not a single-field
 * validator concern).
 */
export class CreateKpiSnapshotDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
