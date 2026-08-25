import { IsOptional, IsUUID } from "class-validator";

export class ListFilesQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
