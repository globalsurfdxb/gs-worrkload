import { IsBoolean, IsISO8601, IsOptional, IsString } from "class-validator";

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
