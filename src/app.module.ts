import { join } from 'path';

import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AnalysisModule } from '@/analysis/analysis.module';
import { AuthModule } from '@/auth/auth.module';
import { BoardModule } from '@/board/board.module';
import { EmailModule } from '@/email/email.module';
import { EventsModule } from '@/events/events.module';
import { HealthModule } from '@/health/health.module';
import { ListModule } from '@/list/list.module';
import { LoggingMiddleware } from '@/middleware/logging.middleware';
import { PrismaModule } from '@/prisma/prisma.module';
import { TaskModule } from '@/task/task.module';
import { UserModule } from '@/user/user.module';

import { AppController } from './app.controller';
import { ImportsModule } from './imports/imports.module';
import { StorageModule } from './storage/storage.module';

@Module({
  controllers: [AppController],
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000,
          limit: 5,
        },
        {
          name: 'long',
          ttl: 60000,
          limit: 60,
        },
      ],
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      ignoreErrors: false,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('DATABASE_IN_MEMORY_HOST'),
          port: configService.getOrThrow<number>('DATABASE_IN_MEMORY_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/assets',
    }),
    PrismaModule,
    AuthModule.register(),
    EventsModule,
    UserModule,
    BoardModule,
    ListModule,
    TaskModule,
    HealthModule,
    AnalysisModule,
    ImportsModule,
    StorageModule,
    EmailModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
