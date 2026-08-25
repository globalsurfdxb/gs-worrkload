import { ApprovalType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from "class-validator";

export class CreateApprovalDto {
  @IsEnum(ApprovalType)
  type!: ApprovalType;

  @IsString()
  @IsNotEmpty()
  entityLabel!: string;

  // Required when type === PROJECT; ValidateIf skips validation entirely otherwise.
  @ValidateIf((dto: CreateApprovalDto) => dto.type === ApprovalType.PROJECT)
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
