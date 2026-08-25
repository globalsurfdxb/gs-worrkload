import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from "class-validator";

export class CreateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
