import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  // Exported so other modules (e.g. TasksModule notifying an assignee on a due
  // date or status change) can inject NotificationsService to raise notifications.
  exports: [NotificationsService],
})
export class NotificationsModule {}
