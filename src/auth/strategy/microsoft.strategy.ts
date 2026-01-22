import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-microsoft';
import { VerifyCallback } from 'passport-oauth2';

import { MicrosoftProfile, ProviderUser } from '../interface/oauth';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    const baseUrl = configService.get<string>('BASE_URL') || 'http://localhost';
    const baseurlApi = configService.get<string>('BASE_URL_API') || 'http://localhost:3000';
    const ProductionBaseUrl = `${baseUrl}/api/v1/auth/microsoft/callback`;
    const DevelopmentBaseUrl = `${baseurlApi}/v1/auth/microsoft/callback`;
    const callbackURL = isProduction ? ProductionBaseUrl : DevelopmentBaseUrl;

    if (!clientID || !clientSecret) {
      throw new Error('Microsoft OAuth credentials are not configured');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user.read'],
      tenant: 'common',
      passReqToCallback: true,
    });
  }

  validate(
    _req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: MicrosoftProfile,
    done: VerifyCallback,
  ): void {
    if (!profile?.id || !profile?.displayName || !profile?.emails?.[0]?.value) {
      return done(new Error('Microsoft profile is incomplete or invalid'), false);
    }

    const user: ProviderUser = {
      providerId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName
    };

    done(null, user);
  }
}
