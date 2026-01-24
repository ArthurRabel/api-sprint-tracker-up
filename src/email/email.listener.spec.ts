import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';

import { EmailListener } from './email.listener';

describe('EmailListener', () => {
  let listener: EmailListener;
  let emailQueue: Queue;

  const mockEmailQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  };

  const testUserPayload = { email: 'user@example.com', name: 'John Doe' };
  const testPasswordPayload = { email: 'user@example.com', resetToken: '123456' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailListener,
        {
          provide: 'BullQueue_email-queue',
          useValue: mockEmailQueue,
        },
      ],
    }).compile();

    listener = module.get<EmailListener>(EmailListener);
    emailQueue = module.get<Queue>('BullQueue_email-queue');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleUserRegisteredEvent', () => {
    it('should add send-welcome-email job to queue', async () => {
      await listener.handleUserRegisteredEvent(testUserPayload);

      expect(emailQueue.add).toHaveBeenCalledWith('send-welcome-email', testUserPayload);
      expect(emailQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple user registrations', async () => {
      const payload1 = { email: 'user1@example.com', name: 'User One' };
      const payload2 = { email: 'user2@example.com', name: 'User Two' };

      await listener.handleUserRegisteredEvent(payload1);
      await listener.handleUserRegisteredEvent(payload2);

      expect(emailQueue.add).toHaveBeenCalledTimes(2);
      expect(emailQueue.add).toHaveBeenNthCalledWith(1, 'send-welcome-email', payload1);
      expect(emailQueue.add).toHaveBeenNthCalledWith(2, 'send-welcome-email', payload2);
    });
  });

  describe('handleForgotPasswordEvent', () => {
    it('should add send-forgot-password-email job to queue', async () => {
      await listener.handleForgotPasswordEvent(testPasswordPayload);

      expect(emailQueue.add).toHaveBeenCalledWith('send-forgot-password-email', {
        email: 'user@example.com',
        code: '123456',
      });
      expect(emailQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should correctly map resetToken to code', async () => {
      const payload = { email: 'test@example.com', resetToken: 'ABC-123-XYZ' };

      await listener.handleForgotPasswordEvent(payload);

      expect(emailQueue.add).toHaveBeenCalledWith('send-forgot-password-email', {
        email: 'test@example.com',
        code: 'ABC-123-XYZ',
      });
    });
  });

  describe('handlePasswordChangedEvent', () => {
    it('should add send-password-changed-email job to queue', async () => {
      await listener.handlePasswordChangedEvent(testUserPayload);

      expect(emailQueue.add).toHaveBeenCalledWith('send-password-changed-email', testUserPayload);
      expect(emailQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple password change events', async () => {
      const payload1 = { email: 'user1@example.com', name: 'User One' };
      const payload2 = { email: 'user2@example.com', name: 'User Two' };

      await listener.handlePasswordChangedEvent(payload1);
      await listener.handlePasswordChangedEvent(payload2);

      expect(emailQueue.add).toHaveBeenCalledTimes(2);
      expect(emailQueue.add).toHaveBeenNthCalledWith(1, 'send-password-changed-email', payload1);
      expect(emailQueue.add).toHaveBeenNthCalledWith(2, 'send-password-changed-email', payload2);
    });
  });

  describe('error handling', () => {
    const error = new Error('Queue connection error');

    beforeEach(() => {
      mockEmailQueue.add.mockRejectedValue(error);
    });

    it('should propagate errors when queue.add fails for user registration', async () => {
      await expect(listener.handleUserRegisteredEvent(testUserPayload)).rejects.toThrow(
        'Queue connection error',
      );
    });

    it('should propagate errors when queue.add fails for forgot password', async () => {
      await expect(listener.handleForgotPasswordEvent(testPasswordPayload)).rejects.toThrow(
        'Queue connection error',
      );
    });

    it('should propagate errors when queue.add fails for password changed', async () => {
      await expect(listener.handlePasswordChangedEvent(testUserPayload)).rejects.toThrow(
        'Queue connection error',
      );
    });
  });
});
