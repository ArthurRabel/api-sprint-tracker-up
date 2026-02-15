import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as handlebars from 'handlebars';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly emailUser: string;
  private readonly isProduction: boolean;
  private readonly cdnBase: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('EMAIL_TRANSPORTER') private readonly transporter: Transporter,
  ) {
    this.emailUser = this.configService.getOrThrow<string>('EMAIL_USER');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.cdnBase = this.configService.getOrThrow<string>('CDN_BASE_URL');
  }

  private loadTemplate(templateName: string): string {
    const filePath = path.join(process.cwd(), 'dist', 'email', 'templates', templateName);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      throw new InternalServerErrorException('Error loading email template.');
    }
  }

  private renderTemplate(templateName: string, context: Record<string, unknown>): string {
    const source = this.loadTemplate(templateName);
    try {
      const tpl = handlebars.compile(source);
      return tpl(context);
    } catch {
      throw new InternalServerErrorException('Error rendering email template.');
    }
  }

  async sendForgotPasswordEmail(to: string, code: string): Promise<void> {
    const html = this.renderTemplate('forgot-password.template.hbs', {
      code,
      BayareaLogoUrl: `${this.cdnBase}/bayarea-logo.png`,
    });

    try {
      await this.transporter.sendMail({
        from: `"Sprint Tracker Support" <${this.emailUser}>`,
        to,
        subject: 'Password Recovery',
        html,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error sending recovery email. Details: ' + String(error),
      );
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const html = this.renderTemplate('welcome-user.template.hbs', {
      name,
      WelcomeGifUrl: `${this.cdnBase}/emails/welcome-animation.gif`,
    });

    try {
      await this.transporter.sendMail({
        from: `"Sprint Tracker" <${this.emailUser}>`,
        to,
        subject: 'Welcome to Sprint Tracker!',
        html,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error sending welcome email. Details: ' + String(error),
      );
    }
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const html = this.renderTemplate('password-changed.template.hbs', {
      name,
      SecurityIconUrl: `${this.cdnBase}/emails/security-icon.png`,
    });

    try {
      await this.transporter.sendMail({
        from: `"Sprint Tracker Support" <${this.emailUser}>`,
        to,
        subject: 'Password Changed Successfully',
        html,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error sending password changed email. Details: ' + String(error),
      );
    }
  }
}
