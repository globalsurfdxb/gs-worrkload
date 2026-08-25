import { IsUUID } from "class-validator";

export class CreateDependencyDto {
  @IsUUID()
  prerequisiteTaskId!: string;
}
