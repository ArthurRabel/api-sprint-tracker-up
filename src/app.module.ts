import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AnalysisModule } from '@/analysis/analysis.module';
import { AuthModule } from '@/auth/auth.module';
import { BoardModule } from '@/board/board.module';
import { EventsModule } from '@/events/events.module';
import { HealthModule } from '@/health/health.module';
import { ListModule } from '@/list/list.module';
import { UserModule } from '@/user/user.module';
import { LoggingMiddleware } from '@/middleware/logging.middleware';
import { PrismaModule } from '@/prisma/prisma.module';
import { TaskModule } from '@/task/task.module';
import { ImportsModule } from './imports/imports.module';
import { StorageModule } from './storage/storage.module';
import { AppController } from './app.controller';

@Module({
  controllers: [
    AppController,
  ],
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
      ]
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
      useFactory: async (configService: ConfigService) => ({
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
