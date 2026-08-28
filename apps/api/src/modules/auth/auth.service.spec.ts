import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

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

  let prisma: {
    client: {
      user: { findUnique: jest.Mock };
      refreshToken: {
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
      };
    };
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'admin@test.com',
            passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder',
            isActive: true,
            tenantRoles: [{ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }],
          }),
        },
        refreshToken: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };

    service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      audit as never,
    );

    jest.spyOn(require('argon2'), 'verify').mockResolvedValue(true);
  });

  it('issues refresh token on login', async () => {
    const result = await service.login('admin@test.com', 'password123');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.client.refreshToken.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGIN' }));
  });

  it('rotates refresh token', async () => {
    prisma.client.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'admin@test.com',
        isActive: true,
        tenantRoles: [{ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }],
      },
    });

    const result = await service.refresh('valid-refresh-token-value-here');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.client.refreshToken.update).toHaveBeenCalled();
  });

  it('rejects invalid refresh token', async () => {
    prisma.client.refreshToken.findFirst.mockResolvedValue(null);
    await expect(service.refresh('invalid-token-value-here')).rejects.toThrow(UnauthorizedException);
  });
});
