import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export const EmailTransporterProvider: Provider = {
  provide: 'EMAIL_TRANSPORTER',
  useFactory: (configService: ConfigService): Transporter => {
    const emailUser = configService.getOrThrow<string>('EMAIL_USER');
    const emailPass = configService.getOrThrow<string>('EMAIL_PASS');
    try {
      return createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error('Error configuring email transporter: ' + message);
    }
  },
  inject: [ConfigService],
};
