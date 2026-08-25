import { ApprovalStatus, ApprovalType } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsUUID } from "class-validator";

export class ListApprovalsQueryDto {
  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  approverId?: string;

  @IsOptional()
  @IsEnum(ApprovalType)
  type?: ApprovalType;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  // Convenience filter for approver-capable roles: rows awaiting a decision
  // that are either already assigned to the caller or still unassigned.
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  pendingForMe?: boolean;
}
