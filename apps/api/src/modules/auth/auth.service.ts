import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { EnvConfig } from '@truemark/config';
import { UserRole } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface AuthUser {
  id: string;
  email: string;
  roles: UserRole[];
  tenantIds: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig>,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ipAddress?: string): Promise<LoginResult> {
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { tenantRoles: true },
    });

    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const authUser = this.toAuthUser(user);
    const accessToken = await this.signAccessToken(authUser);
    const refreshToken = await this.issueRefreshToken(user.id);

    await this.audit.log({
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: user.id,
      userId: user.id,
      tenantId: authUser.tenantIds.length === 1 ? authUser.tenantIds[0] : undefined,
      ipAddress,
    });

    return { accessToken, refreshToken, user: authUser };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const record = await this.prisma.client.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { tenantRoles: true } } },
    });

    if (!record?.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.client.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const authUser = this.toAuthUser(record.user);
    const accessToken = await this.signAccessToken(authUser);
    const nextRefreshToken = await this.issueRefreshToken(record.userId);

    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logout(refreshToken: string, userId?: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (userId) {
      await this.audit.log({
        action: 'USER_LOGOUT',
        resourceType: 'user',
        resourceId: userId,
        userId,
      });
    }

    return { success: true };
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { tenantRoles: true },
    });
    if (!user?.isActive) return null;
    return this.toAuthUser(user);
  }

  /** @deprecated use signAccessToken */
  async signToken(user: AuthUser): Promise<string> {
    return this.signAccessToken(user);
  }

  async signAccessToken(user: AuthUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, roles: user.roles, tenantIds: user.tenantIds },
      {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }) ?? '1h',
      },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefreshToken(raw);
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }) ?? '7d';
    const expiresAt = this.parseDuration(expiresIn);

    await this.prisma.client.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return raw;
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(value: string): Date {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const ms =
      unit === 's'
        ? amount * 1000
        : unit === 'm'
          ? amount * 60_000
          : unit === 'h'
            ? amount * 3_600_000
            : amount * 86_400_000;
    return new Date(Date.now() + ms);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    tenantRoles: Array<{ role: UserRole; tenantId: string | null }>;
  }): AuthUser {
    const roles = [...new Set(user.tenantRoles.map((r) => r.role))];
    const tenantIds = [
      ...new Set(user.tenantRoles.map((r) => r.tenantId).filter(Boolean) as string[]),
    ];
    return { id: user.id, email: user.email, roles, tenantIds };
  }
}
