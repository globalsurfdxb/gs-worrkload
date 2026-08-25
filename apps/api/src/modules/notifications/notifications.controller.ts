import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notificationsService.findForUser(user.id, query.unreadOnly);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
