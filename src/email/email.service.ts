import * as fs from 'fs';
import * as path from 'path';

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly emailUser: string;
  private readonly emailPass: string;
  private readonly nodeEnv: string;

  constructor(private readonly configService: ConfigService) {
    this.emailUser = this.configService.getOrThrow<string>('EMAIL');
    this.emailPass = this.configService.getOrThrow<string>('PASS');
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    try {
      this.transporter = createTransport({
        service: 'gmail',
        auth: {
          user: this.emailUser,
          pass: this.emailPass,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Error configuring email service. Please check credentials. ' + message,
      );
    }
  }

  getTransporter(): Transporter {
    return this.transporter;
  }

  private loadTemplate(templateName: string): string {
    const templateBaseDir = path.join(__dirname, 'templates');
    const filePath = path.join(templateBaseDir, templateName);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      throw new InternalServerErrorException('Error loading email template.');
    }
  }

  async sendForgotPasswordEmail(to: string, code: string): Promise<void> {
    const html = this.loadTemplate('forgot-password.template.html').replace('{{code}}', code);

    try {
      await this.transporter.sendMail({
        from: `"Sprint Tracker Support" <${this.emailUser}>`,
        to,
        subject: 'Password Recovery',
        html,
        attachments: [
          {
            filename: 'bayarea-logo.png',
            path:
              this.nodeEnv === 'production'
                ? 'dist/src/assets/bayarea-logo.png'
                : 'src/assets/bayarea-logo.png',
            cid: 'bayarea-logo',
          },
          {
            filename: 'iesb-logo.png',
            path:
              this.nodeEnv === 'production'
                ? 'dist/src/assets/iesb-logo.png'
                : 'src/assets/iesb-logo.png',
            cid: 'iesb-logo',
          },
        ],
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error sending recovery email. Details: ' + String(error),
      );
    }
  }
}
