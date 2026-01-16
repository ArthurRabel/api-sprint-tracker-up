import { DynamicModule, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { GoogleStrategy } from '@/auth/strategy/google.strategy';
import { JwtStrategy } from '@/auth/strategy/jwt.strategy';
import { MicrosoftStrategy } from '@/auth/strategy/microsoft.strategy';
import { EmailModule } from '@/email/email.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

export const OAUTH_STRATEGIES_TOKEN = 'OAUTH_STRATEGIES';

function createOauthStrategies(configService: ConfigService) {
  const strategies: Array<GoogleStrategy | MicrosoftStrategy> = [];

  if (configService.get<string>('ENABLE_GOOGLE_OAUTH') === 'true') {
    strategies.push(new GoogleStrategy(configService));
  }

  if (configService.get<string>('ENABLE_MICROSOFT_OAUTH') === 'true') {
    strategies.push(new MicrosoftStrategy(configService));
  }

  return strategies;
}

function getJwtConfig(configService: ConfigService) {
  return {
    secret: configService.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: '1d' },
  };
}

@Module({})
export class AuthModule {
  static register(): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      providers: [
        Logger,
        JwtStrategy,
        AuthService,
        {
          provide: OAUTH_STRATEGIES_TOKEN,
          useFactory: createOauthStrategies,
          inject: [ConfigService],
        },
      ],
      controllers: [AuthController],
      imports: [
        PassportModule,
        PrismaModule,
        EmailModule,
        UserModule,
        JwtModule.registerAsync({
          useFactory: getJwtConfig,
          inject: [ConfigService],
        }),
      ],
      exports: [AuthService, JwtModule],
    };
  }
}
