import { createHash } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "./jwt-payload.interface";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserView {
  id: string;
  fullName: string;
  email: string;
  role: JwtPayload["role"];
  departmentId: string | null;
  teamIds: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair & { user: AuthenticatedUserView }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { teamMemberships: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      teamIds: user.teamMemberships.map((m) => m.teamId),
    };

    const tokens = await this.issueTokenPair(payload);
    return {
      ...tokens,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        teamIds: payload.teamIds,
      },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token has been revoked or expired.");
    }

    // Rotate: revoke the old token and issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { teamMemberships: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is no longer active.");
    }

    const freshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      teamIds: user.teamMemberships.map((m) => m.teamId),
    };

    return this.issueTokenPair(freshPayload);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(payload: JwtPayload): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES_IN"),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN"),
    });

    const expiresInMs = this.parseExpiryToMs(
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d",
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private parseExpiryToMs(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2] as "s" | "m" | "h" | "d" | undefined;
    const unitMs = (unit && { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]) || 86_400_000;
    return value * unitMs;
  }
}
