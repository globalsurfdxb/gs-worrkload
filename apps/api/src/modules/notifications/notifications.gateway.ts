import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import type { JwtPayload } from "../auth/jwt-payload.interface";

@WebSocketGateway({
  namespace: "/notifications",
  cors: { origin: process.env.API_CORS_ORIGIN ?? "*", credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // The JwtAuthGuard/RolesGuard combo is wired globally for HTTP routes only —
  // Nest does not run HTTP guards against WS gateways, so the socket handshake
  // is authenticated by hand here.
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        throw new Error("Missing token");
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });

      client.data.userId = payload.sub;
      client.join(payload.sub);
    } catch (error) {
      this.logger.warn(`Rejected notifications socket connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket): void {
    // No-op: Socket.IO removes the client from its room(s) automatically on disconnect.
  }

  emitToUser(userId: string, notification: unknown): void {
    this.server.to(userId).emit("notification", notification);
  }
}
