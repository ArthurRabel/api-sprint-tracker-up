import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailService } from '@/infrastructure/email/email.service';

import { EmailProcessor } from './email.processor';
import { EmailListener } from './listeners/email.listener';
import { EmailTransporterProvider } from './transporters/email.transporter.provider';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email-queue',
    }),
  ],
  providers: [EmailTransporterProvider, EmailService, EmailListener, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
