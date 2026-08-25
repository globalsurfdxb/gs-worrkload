import { Injectable, NotFoundException } from "@nestjs/common";
import { Notification, NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // Email delivery is out of scope for this pass — future work is to fan this
  // out to an SMTP integration alongside the in-app/socket notification below.
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): Promise<Notification> {
    const created = await this.prisma.notification.create({
      data: { userId, type, title, body, link },
    });

    this.gateway.emitToUser(userId, created);

    return created;
  }

  async findForUser(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification ${id} not found.`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { count };
  }
}
