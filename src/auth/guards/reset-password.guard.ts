import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Observable } from 'rxjs';

import { jwtFromCookie } from '../utils/jwt-cookie-extraction';

interface ResetPasswordPayload {
  userId: string;
  email: string;
  purpose: 'reset-password';
  iat?: number;
  exp?: number;
}

@Injectable()
export class ResetPasswordGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context
      .switchToHttp()
      .getRequest<Request & { user?: ResetPasswordPayload }>();

    const token = jwtFromCookie(request, 'reset-token');
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Reset token not provided.');
    }

    try {
      const secret = this.configService.get<string>('JWT_RESET_SECRET');
      if (!secret) {
        throw new Error('JWT_RESET_SECRET not configured.');
      }

      const payload: ResetPasswordPayload = this.jwtService.verify(token, {
        secret: secret,
      });

      if (payload.purpose !== 'reset-password') {
        throw new UnauthorizedException('This token is not valid for password reset.');
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Reset token expired or invalid.');
        }
        if (error.name === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid reset token.');
        }

        throw new BadRequestException('Error validating reset token: ' + String(error));
      }
      throw new BadRequestException('Unknown error validating reset token.');
    }
  }
}
