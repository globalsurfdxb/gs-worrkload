import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class CreateDepartmentDto {
  /**
   * Optional: GS WorkHub is currently single-organization (GlobalSurf), so the
   * frontend never has an organization id to send. When omitted, the service
   * defaults to the sole existing Organization row. Accepted here only for
   * a future multi-organization setup.
   */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, {
    message: "code must contain only uppercase letters, numbers, hyphens, and underscores.",
  })
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
