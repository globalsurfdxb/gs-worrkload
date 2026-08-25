import { IsOptional, IsString } from "class-validator";

export class ApproveApprovalDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
