import { IsUUID } from "class-validator";

export class AddWatcherDto {
  @IsUUID()
  userId!: string;
}
