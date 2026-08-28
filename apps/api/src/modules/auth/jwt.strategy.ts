import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '@truemark/config';
import { UserRole } from '@truemark/db';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  tenantIds: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvConfig>,
    private readonly authService: AuthService,
  ) {
    const secret = config.get('JWT_SECRET', { infer: true });
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) return null;
    return user;
  }
}
