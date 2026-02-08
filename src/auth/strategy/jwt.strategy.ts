import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

import { AuthRepository } from '../auth.repository';
import { User } from '../types/auth.types';
import { jwtFromCookie } from '../utils/jwt-cookie-extraction';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: jwtFromCookie,
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        (() => {
          throw new Error('JWT_SECRET is not defined');
        })(),
    });
  }

  async validate(payload: { sub: string }): Promise<User> {
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario não encontrado');
    }
    return user;
  }
}
