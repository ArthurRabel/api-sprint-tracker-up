import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AwsS3Module } from './awsS3/awsS3.module';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

function getInfrastructureImports(): Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> {
  const dbInMemoryEnabled = process.env.ENABLE_DATABASE_IN_MEMORY === 'true';
  const emailEnabled = process.env.ENABLE_EMAIL === 'true';

  const baseImports: Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> = [
    PrismaModule,
    EventsModule,
    HealthModule,
    AwsS3Module,
  ];

  if (dbInMemoryEnabled) {
    baseImports.push(
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
    );

    if (emailEnabled) {
      baseImports.push(EmailModule);
    }
  }

  return baseImports;
}

@Module({
  imports: getInfrastructureImports(),
  exports: [PrismaModule, EventsModule, HealthModule, AwsS3Module],
})
export class InfrastructureModule {}
