import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  /** Union of all roles across tenants — for display only; authorize with {@link rolesForTenant}. */
  roles: UserRole[];
  tenantIds: string[];
  /** Roles granted platform-wide (UserTenantRole.tenantId = null). */
  globalRoles?: UserRole[];
  /** Roles scoped to a single tenant. */
  rolesByTenant?: Record<string, UserRole[]>;
}

/** Effective roles for a tenant-scoped request: global roles plus that tenant's roles only. */
export function rolesForTenant(user: AuthUser, tenantId: string): UserRole[] {
  if (!user.rolesByTenant && !user.globalRoles) return user.roles;
  return [...new Set([...(user.globalRoles ?? []), ...(user.rolesByTenant?.[tenantId] ?? [])])];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the user does not exist so response time does not reveal valid emails. */
  private dummyHashPromise?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig>,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ipAddress?: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.client.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { tenantRoles: true },
    });

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, password).catch(() => false);

    if (!user?.passwordHash || !user.isActive || !valid) {
      await this.audit
        .log({
          action: 'USER_LOGIN_FAILED',
          resourceType: 'user',
          resourceId: user?.id,
          userId: user?.id,
          ipAddress,
          after: { email: normalizedEmail },
        })
        .catch((err: unknown) => this.logger.warn(`Failed to audit login failure: ${String(err)}`));
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
    const record = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenantRoles: true } } },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      // A rotated token was presented again: treat as theft and revoke the whole session family.
      await this.revokeAllForUser(record.userId);
      this.logger.warn(`Refresh token reuse detected for user ${record.userId}; all sessions revoked`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt <= new Date() || !record.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Conditional update makes rotation atomic: concurrent refreshes with the same token lose.
    const { count } = await this.prisma.client.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const authUser = this.toAuthUser(record.user);
    const accessToken = await this.signAccessToken(authUser);
    const nextRefreshToken = await this.issueRefreshToken(record.userId);

    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logoutAll(userId: string) {
    await this.revokeAllForUser(userId);
    await this.audit.log({
      action: 'USER_LOGOUT',
      resourceType: 'user',
      resourceId: userId,
      userId,
      after: { scope: 'all_sessions' },
    });
    return { success: true };
  }

  private async revokeAllForUser(userId: string) {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= argon2.hash(randomBytes(32).toString('hex'));
    return this.dummyHashPromise;
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
    const globalRoles = [
      ...new Set(user.tenantRoles.filter((r) => r.tenantId === null).map((r) => r.role)),
    ];
    const rolesByTenant: Record<string, UserRole[]> = {};
    for (const { tenantId, role } of user.tenantRoles) {
      if (!tenantId) continue;
      rolesByTenant[tenantId] = [...new Set([...(rolesByTenant[tenantId] ?? []), role])];
    }
    return { id: user.id, email: user.email, roles, tenantIds, globalRoles, rolesByTenant };
  }
}
