import { UnauthorizedException } from '@nestjs/common';
import { AuthService, rolesForTenant } from './auth.service';

describe('AuthService', () => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };
  const config = {
    get: (key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-minimum-32-characters-long';
      if (key === 'JWT_EXPIRES_IN') return '1h';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    },
  };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const argon2 = require('argon2');

  const activeUser = {
    id: 'user-1',
    email: 'admin@test.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder',
    isActive: true,
    tenantRoles: [{ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }],
  };

  let prisma: {
    client: {
      user: { findFirst: jest.Mock; findUnique: jest.Mock };
      refreshToken: {
        findUnique: jest.Mock;
        create: jest.Mock;
        updateMany: jest.Mock;
      };
    };
  };

  let service: AuthService;

  function futureDate() {
    return new Date(Date.now() + 60_000);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      client: {
        user: {
          findFirst: jest.fn().mockResolvedValue(activeUser),
          findUnique: jest.fn().mockResolvedValue(activeUser),
        },
        refreshToken: {
          findUnique: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };

    service = new AuthService(prisma as never, jwt as never, config as never, audit as never);

    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
    jest.spyOn(argon2, 'hash').mockResolvedValue('$argon2id$dummy');
  });

  it('issues refresh token on login', async () => {
    const result = await service.login('admin@test.com', 'password123');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.client.refreshToken.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGIN' }));
  });

  it('normalizes email case and whitespace on login', async () => {
    await service.login('  Admin@Test.COM ', 'password123');
    expect(prisma.client.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'admin@test.com', mode: 'insensitive' } },
      }),
    );
  });

  it('still runs a password hash check for unknown users (timing safety) and audits failure', async () => {
    prisma.client.user.findFirst.mockResolvedValue(null);
    await expect(service.login('ghost@test.com', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(argon2.verify).toHaveBeenCalledWith('$argon2id$dummy', 'password123');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGIN_FAILED' }));
  });

  it('rejects inactive users even with a correct password', async () => {
    prisma.client.user.findFirst.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(service.login('admin@test.com', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotates refresh token atomically', async () => {
    prisma.client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: futureDate(),
      user: activeUser,
    });

    const result = await service.refresh('valid-refresh-token-value-here');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects the loser of a concurrent refresh race', async () => {
    prisma.client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: futureDate(),
      user: activeUser,
    });
    prisma.client.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh('valid-refresh-token-value-here')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.client.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes all sessions when a revoked refresh token is reused', async () => {
    prisma.client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: futureDate(),
      user: activeUser,
    });
    await expect(service.refresh('stolen-refresh-token-value')).rejects.toThrow(UnauthorizedException);
    expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects expired refresh tokens', async () => {
    prisma.client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: activeUser,
    });
    await expect(service.refresh('expired-token-value-here')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unknown refresh token', async () => {
    prisma.client.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('invalid-token-value-here')).rejects.toThrow(UnauthorizedException);
  });

  it('logout-all revokes every active session for the user', async () => {
    await service.logoutAll('user-1');
    expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('scopes roles per tenant', async () => {
    prisma.client.user.findUnique.mockResolvedValue({
      ...activeUser,
      tenantRoles: [
        { role: 'TENANT_ADMIN', tenantId: 'tenant-a' },
        { role: 'READ_ONLY', tenantId: 'tenant-b' },
      ],
    });
    const user = await service.validateUser('user-1');
    expect(user).not.toBeNull();
    expect(rolesForTenant(user!, 'tenant-a')).toEqual(['TENANT_ADMIN']);
    expect(rolesForTenant(user!, 'tenant-b')).toEqual(['READ_ONLY']);
    expect(rolesForTenant(user!, 'tenant-c')).toEqual([]);
  });
});
