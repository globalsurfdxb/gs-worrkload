import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { TemplateMilestoneDto } from "./template-milestone.dto";

export class CreateProjectTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMilestoneDto)
  defaultMilestones!: TemplateMilestoneDto[];
}
