import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

/**
 * Shape of one entry inside ProjectTemplate.defaultMilestones (stored as Json).
 */
export class TemplateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetDays?: number;
}
