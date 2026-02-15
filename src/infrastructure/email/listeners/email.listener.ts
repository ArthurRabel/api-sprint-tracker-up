import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

@Injectable()
export class EmailListener {
  constructor(@InjectQueue('email-queue') private emailQueue: Queue) {}

  @OnEvent('user.registered')
  async handleUserRegisteredEvent(payload: { email: string; name: string }) {
    await this.emailQueue.add('send-welcome-email', {
      email: payload.email,
      name: payload.name,
    });
  }

  @OnEvent('user.forgotPassword')
  async handleForgotPasswordEvent(payload: { email: string; resetToken: string }) {
    await this.emailQueue.add('send-forgot-password-email', {
      email: payload.email,
      code: payload.resetToken,
    });
  }

  @OnEvent('user.changePassword')
  async handlePasswordChangedEvent(payload: { email: string; name: string }) {
    await this.emailQueue.add('send-password-changed-email', {
      email: payload.email,
      name: payload.name,
    });
  }
}
