import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

import { GoogleProfile, ProviderUser } from '../interface/oauth';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    const baseUrl = configService.get<string>('BASE_URL') || 'http://localhost';
    const baseurlApi = configService.get<string>('BASE_URL_API') || 'http://localhost:3000';
    const ProductionBaseUrl = `${baseUrl}/api/v1/auth/google/callback`;
    const DevelopmentBaseUrl = `${baseurlApi}/v1/auth/google/callback`;
    const callbackURL = isProduction ? ProductionBaseUrl : DevelopmentBaseUrl;

    if (!clientID || !clientSecret || !baseUrl) {
      throw new Error('Google OAuth configuration is missing');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    _req: Request,
    accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): void {
    if (!profile?.id || !profile?.displayName || !profile?.emails?.[0]?.value) {
      return done(new Error('Google profile is incomplete or invalid'), false);
    }

    const user: ProviderUser = {
      providerId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      accessToken: accessToken,
    };

    done(null, user);
  }
}
