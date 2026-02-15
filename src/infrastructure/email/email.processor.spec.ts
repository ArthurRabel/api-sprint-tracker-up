import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

import { EmailProcessor } from './email.processor';
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

type JobType = 'send-welcome-email' | 'send-forgot-password-email' | 'send-password-changed-email';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let emailService: EmailService;

  const mockEmailService = {
    sendWelcomeEmail: jest.fn(),
    sendForgotPasswordEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
  };

  const createMockJob = <T>(name: JobType, data: T): Job<T, void, JobType> =>
    ({
      name,
      data,
    }) as Job<T, void, JobType>;

  const setupLogger = (): void => {
    jest.spyOn(processor['logger'], 'log').mockImplementation();
    jest.spyOn(processor['logger'], 'warn').mockImplementation();
    jest.spyOn(processor['logger'], 'error').mockImplementation();
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    emailService = module.get<EmailService>(EmailService);
    setupLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should process welcome email job', async () => {
      const mockJob = createMockJob<WelcomeEmailData>('send-welcome-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing welcome email for: user@example.com',
      );
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('user@example.com', 'John Doe');
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Welcome email sent successfully to: user@example.com',
      );
    });

    it('should process forgot password email job', async () => {
      const mockJob = createMockJob<ForgotPasswordEmailData>('send-forgot-password-email', {
        email: 'user@example.com',
        code: '123456',
      });

      mockEmailService.sendForgotPasswordEmail.mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing forgot password email for: user@example.com',
      );
      expect(emailService.sendForgotPasswordEmail).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
      );
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Forgot password email sent successfully to: user@example.com',
      );
    });

    it('should process password changed email job', async () => {
      const mockJob = createMockJob<PasswordChangedEmailData>('send-password-changed-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      mockEmailService.sendPasswordChangedEmail.mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing password changed email for: user@example.com',
      );
      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'user@example.com',
        'John Doe',
      );
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Password changed email sent successfully to: user@example.com',
      );
    });

    it('should log warning for unknown job type', async () => {
      const mockJob = {
        name: 'unknown-job-type',
        data: { email: '', name: '' },
      } as unknown as Job<WelcomeEmailData, void, JobType>;

      await processor.process(mockJob);

      expect(processor['logger'].warn).toHaveBeenCalledWith('Unknown job type: unknown-job-type');
    });
  });

  describe('processWelcomeEmail', () => {
    it('should process welcome email successfully', async () => {
      const mockJob = createMockJob<WelcomeEmailData>('send-welcome-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

      await processor['processWelcomeEmail'](mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing welcome email for: user@example.com',
      );
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('user@example.com', 'John Doe');
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Welcome email sent successfully to: user@example.com',
      );
    });

    it('should log error and throw when email sending fails', async () => {
      const mockJob = createMockJob<WelcomeEmailData>('send-welcome-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      const error = new Error('SMTP error');
      mockEmailService.sendWelcomeEmail.mockRejectedValue(error);

      await expect(processor['processWelcomeEmail'](mockJob)).rejects.toThrow('SMTP error');

      expect(processor['logger'].error).toHaveBeenCalledWith(
        'Failed to send welcome email to user@example.com:',
        error,
      );
    });
  });

  describe('processForgotPasswordEmail', () => {
    it('should process forgot password email successfully', async () => {
      const mockJob = createMockJob<ForgotPasswordEmailData>('send-forgot-password-email', {
        email: 'user@example.com',
        code: '123456',
      });

      mockEmailService.sendForgotPasswordEmail.mockResolvedValue(undefined);

      await processor['processForgotPasswordEmail'](mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing forgot password email for: user@example.com',
      );
      expect(emailService.sendForgotPasswordEmail).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
      );
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Forgot password email sent successfully to: user@example.com',
      );
    });

    it('should log error and throw when email sending fails', async () => {
      const mockJob = createMockJob<ForgotPasswordEmailData>('send-forgot-password-email', {
        email: 'user@example.com',
        code: '123456',
      });

      const error = new Error('SMTP error');
      mockEmailService.sendForgotPasswordEmail.mockRejectedValue(error);

      await expect(processor['processForgotPasswordEmail'](mockJob)).rejects.toThrow('SMTP error');

      expect(processor['logger'].error).toHaveBeenCalledWith(
        'Failed to send forgot password email to user@example.com:',
        error,
      );
    });
  });

  describe('processPasswordChangedEmail', () => {
    it('should process password changed email successfully', async () => {
      const mockJob = createMockJob<PasswordChangedEmailData>('send-password-changed-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      mockEmailService.sendPasswordChangedEmail.mockResolvedValue(undefined);

      await processor['processPasswordChangedEmail'](mockJob);

      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Processing password changed email for: user@example.com',
      );
      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'user@example.com',
        'John Doe',
      );
      expect(processor['logger'].log).toHaveBeenCalledWith(
        'Password changed email sent successfully to: user@example.com',
      );
    });

    it('should log error and throw when email sending fails', async () => {
      const mockJob = createMockJob<PasswordChangedEmailData>('send-password-changed-email', {
        email: 'user@example.com',
        name: 'John Doe',
      });

      const error = new Error('SMTP error');
      mockEmailService.sendPasswordChangedEmail.mockRejectedValue(error);

      await expect(processor['processPasswordChangedEmail'](mockJob)).rejects.toThrow('SMTP error');

      expect(processor['logger'].error).toHaveBeenCalledWith(
        'Failed to send password changed email to user@example.com:',
        error,
      );
    });
  });
});
