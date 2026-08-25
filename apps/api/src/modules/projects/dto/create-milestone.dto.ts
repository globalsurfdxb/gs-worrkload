import { IsISO8601, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
