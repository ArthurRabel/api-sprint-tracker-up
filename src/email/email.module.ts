import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from '@/email/email.service';
import { EmailTransporterProvider } from './transporters/email.transporter.provider';
import { EmailListener } from './email.listener';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email-queue',
    }),
  ],
  providers: [
    EmailTransporterProvider,
    EmailService,
    EmailListener,
    EmailProcessor,
  ],
  exports: [EmailService],
})
export class EmailModule {}
