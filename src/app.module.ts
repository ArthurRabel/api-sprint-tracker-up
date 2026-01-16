import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AnalysisModule } from '@/analysis/analysis.module';
import { AuthModule } from '@/auth/auth.module';
import { BoardModule } from '@/board/board.module';
import { EventsModule } from '@/events/events.module';
import { HealthModule } from '@/health/health.module';
import { ListModule } from '@/list/list.module';
import { ProfileModule } from '@/me/me.module';
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
    PrismaModule,
    AuthModule.register(),
    EventsModule,
    ProfileModule,
    BoardModule,
    ListModule,
    TaskModule,
    HealthModule,
    AnalysisModule,
    ImportsModule,
    StorageModule,
  ],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
