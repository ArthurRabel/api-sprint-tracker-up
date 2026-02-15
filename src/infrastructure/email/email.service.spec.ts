import * as fs from 'fs';

import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as handlebars from 'handlebars';
import { Transporter } from 'nodemailer';

import { EmailService } from './email.service';

jest.mock('fs');
jest.mock('handlebars');

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: jest.Mocked<Transporter>;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        EMAIL_USER: 'test@example.com',
        CDN_BASE_URL: 'https://cdn.example.com',
      };
      return config[key];
    }),
    get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'development' : null)),
  };

  const setupTemplate = (template: string, compiledHtml: string): void => {
    (fs.readFileSync as jest.Mock).mockReturnValue(template);
    (handlebars.compile as jest.Mock).mockReturnValue(jest.fn().mockReturnValue(compiledHtml));
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    } as unknown as jest.Mocked<Transporter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'EMAIL_TRANSPORTER',
          useValue: mockTransporter,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('EMAIL_USER');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('CDN_BASE_URL');
      expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV');
    });
  });

  describe('loadTemplate', () => {
    it('should load template successfully', () => {
      const mockTemplate = '<html>{{code}}</html>';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockTemplate);

      const result = service['loadTemplate']('test-template.hbs');

      expect(result).toBe(mockTemplate);
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when template loading fails', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => service['loadTemplate']('non-existent.hbs')).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('renderTemplate', () => {
    it('should render template successfully', () => {
      const mockTemplate = '<html>{{code}}</html>';
      const compiledHtml = '<html>123456</html>';
      setupTemplate(mockTemplate, compiledHtml);

      const result = service['renderTemplate']('test-template.hbs', { code: '123456' });

      expect(result).toBe(compiledHtml);
      expect(handlebars.compile).toHaveBeenCalledWith(mockTemplate);
    });

    it('should throw InternalServerErrorException when template rendering fails', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('<html>{{code}}</html>');
      (handlebars.compile as jest.Mock).mockImplementation(() => {
        throw new Error('Compilation error');
      });

      expect(() => service['renderTemplate']('test-template.hbs', { code: '123456' })).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('sendForgotPasswordEmail', () => {
    it('should send forgot password email successfully', async () => {
      setupTemplate('<html>{{code}}</html>', '<html>123456</html>');

      await service.sendForgotPasswordEmail('user@example.com', '123456');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Sprint Tracker Support" <test@example.com>',
        to: 'user@example.com',
        subject: 'Password Recovery',
        html: '<html>123456</html>',
      });
    });

    it('should throw InternalServerErrorException when sending fails', async () => {
      setupTemplate('<html>{{code}}</html>', '<html>123456</html>');
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.sendForgotPasswordEmail('user@example.com', '123456')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      setupTemplate('<html>{{name}}</html>', '<html>John Doe</html>');

      await service.sendWelcomeEmail('user@example.com', 'John Doe');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Sprint Tracker" <test@example.com>',
        to: 'user@example.com',
        subject: 'Welcome to Sprint Tracker!',
        html: '<html>John Doe</html>',
      });
    });

    it('should throw InternalServerErrorException when sending fails', async () => {
      setupTemplate('<html>{{name}}</html>', '<html>John Doe</html>');
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.sendWelcomeEmail('user@example.com', 'John Doe')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email successfully', async () => {
      setupTemplate('<html>{{name}}</html>', '<html>John Doe</html>');

      await service.sendPasswordChangedEmail('user@example.com', 'John Doe');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Sprint Tracker Support" <test@example.com>',
        to: 'user@example.com',
        subject: 'Password Changed Successfully',
        html: '<html>John Doe</html>',
      });
    });

    it('should throw InternalServerErrorException when sending fails', async () => {
      setupTemplate('<html>{{name}}</html>', '<html>John Doe</html>');
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendPasswordChangedEmail('user@example.com', 'John Doe'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
