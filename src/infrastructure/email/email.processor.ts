import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EmailService } from './email.service';

interface WelcomeEmailData {
  email: string;
  name: string;
}

interface ForgotPasswordEmailData {
  email: string;
  code: string;
}

interface PasswordChangedEmailData {
  email: string;
  name: string;
}

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(
    job: Job<
      WelcomeEmailData | ForgotPasswordEmailData | PasswordChangedEmailData,
      void,
      'send-welcome-email' | 'send-forgot-password-email' | 'send-password-changed-email'
    >,
  ): Promise<void> {
    switch (job.name) {
      case 'send-welcome-email':
        await this.processWelcomeEmail(job as Job<WelcomeEmailData>);
        break;
      case 'send-forgot-password-email':
        await this.processForgotPasswordEmail(job as Job<ForgotPasswordEmailData>);
        break;
      case 'send-password-changed-email':
        await this.processPasswordChangedEmail(job as Job<PasswordChangedEmailData>);
        break;
      default:
        this.logger.warn(`Unknown job type: ${String(job.name)}`);
    }
  }

  private async processWelcomeEmail(job: Job<WelcomeEmailData>): Promise<void> {
    const { email, name } = job.data;
    this.logger.log(`Processing welcome email for: ${email}`);

    try {
      await this.emailService.sendWelcomeEmail(email, name);
      this.logger.log(`Welcome email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw error;
    }
  }

  private async processForgotPasswordEmail(job: Job<ForgotPasswordEmailData>): Promise<void> {
    const { email, code } = job.data;
    this.logger.log(`Processing forgot password email for: ${email}`);

    try {
      await this.emailService.sendForgotPasswordEmail(email, code);
      this.logger.log(`Forgot password email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send forgot password email to ${email}:`, error);
      throw error;
    }
  }

  private async processPasswordChangedEmail(job: Job<PasswordChangedEmailData>): Promise<void> {
    const { email, name } = job.data;
    this.logger.log(`Processing password changed email for: ${email}`);

    try {
      await this.emailService.sendPasswordChangedEmail(email, name);
      this.logger.log(`Password changed email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${email}:`, error);
      throw error;
    }
  }
}
