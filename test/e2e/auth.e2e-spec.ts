import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import {
  mockChangePasswordDto,
  mockForgotPasswordDto,
  mockResetPasswordDto,
  mockSignInDto,
  mockSignUpDto,
  mockVerifyResetCodeDto,
} from '../fixtures/user.fixture';
import { createTestUser, extractAuthCookie } from '../helpers/auth.helper';
import {
  cleanDatabase,
  getPrismaClient,
  setupTestDatabase,
  teardownTestDatabase,
} from '../helpers/database.helper';
import { getCookiesFromResponse } from '../types/test.types';

describe('Auth E2E Tests', () => {
  let app: INestApplication;
  let httpServer: Server;
  let jwtService: JwtService;
  let configService: ConfigService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    await setupTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EventEmitter2)
      .useValue({
        on: jest.fn(),
        emit: jest.fn(),
        emitAsync: jest.fn(),
        removeAllListeners: jest.fn(),
      })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: jest.fn().mockResolvedValue({
          totalHits: 0,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlock: 0,
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());

    await app.init();

    httpServer = app.getHttpServer() as Server;
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
    jest.clearAllMocks();
  });

  describe('POST /v1/auth/signup', () => {
    it('should register a new user successfully', async () => {
      const signUpData = mockSignUpDto();

      const response = await request(httpServer)
        .post('/v1/auth/signup')
        .send(signUpData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.headers['set-cookie']).toBeDefined();

      const cookies = getCookiesFromResponse(response);
      const authCookie = extractAuthCookie(cookies);
      expect(authCookie).toContain('sprinttacker-session=');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.registered',
        expect.objectContaining({
          email: signUpData.email,
          name: signUpData.name,
        }),
      );
    });

    it('should fail with duplicate email', async () => {
      const signUpData = mockSignUpDto();

      await request(httpServer).post('/v1/auth/signup').send(signUpData).expect(201);

      const duplicateData = mockSignUpDto({
        email: signUpData.email,
        userName: 'different_username',
      });

      await request(httpServer).post('/v1/auth/signup').send(duplicateData).expect(409);
    });

    it('should fail with duplicate username', async () => {
      const signUpData = mockSignUpDto();

      await request(httpServer).post('/v1/auth/signup').send(signUpData).expect(201);

      const duplicateData = mockSignUpDto({
        email: 'different@email.com',
        userName: signUpData.userName,
      });

      await request(httpServer).post('/v1/auth/signup').send(duplicateData).expect(409);
    });

    it('should fail with invalid email format', async () => {
      const signUpData = mockSignUpDto({ email: 'invalid-email' });

      await request(httpServer).post('/v1/auth/signup').send(signUpData).expect(400);
    });

    it('should fail with weak password', async () => {
      const signUpData = mockSignUpDto({ password: 'weak' });

      await request(httpServer).post('/v1/auth/signup').send(signUpData).expect(400);
    });

    it('should fail with missing required fields', async () => {
      await request(httpServer)
        .post('/v1/auth/signup')
        .send({ email: 'test@test.com' })
        .expect(400);
    });
  });

  describe('POST /v1/auth/signin', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, password, false);

      const response = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.headers['set-cookie']).toBeDefined();

      const cookies = getCookiesFromResponse(response);
      const authCookie = extractAuthCookie(cookies);
      expect(authCookie).toContain('sprinttacker-session=');
    });

    it('should set longer expiry with rememberMe=true', async () => {
      const password = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, password, true);

      const response = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      const cookies = getCookiesFromResponse(response);
      const authCookie = cookies.find((c: string) => c.startsWith('sprinttacker-session='));

      expect(authCookie).toContain('Expires');
    });

    it('should fail with invalid email', async () => {
      const signInData = mockSignInDto('nonexistent@test.com', 'Password123!', false);

      await request(httpServer).post('/v1/auth/signin').send(signInData).expect(401);
    });

    it('should fail with invalid password', async () => {
      const user = await createTestUser();
      const signInData = mockSignInDto(user.email, 'WrongPassword123!', false);

      await request(httpServer).post('/v1/auth/signin').send(signInData).expect(401);
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    it('should send password reset request successfully', async () => {
      const user = await createTestUser();
      const forgotPasswordData = mockForgotPasswordDto(user.email);

      const response = await request(httpServer)
        .post('/v1/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.forgotPassword',
        expect.objectContaining({
          email: user.email,
          resetToken: expect.any(String) as string,
        }),
      );
    });

    it('should handle non-existent email gracefully', async () => {
      const forgotPasswordData = mockForgotPasswordDto('nonexistent@test.com');

      await request(httpServer)
        .post('/v1/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(200);
    });
  });

  describe('POST /v1/auth/verify-reset-code', () => {
    it('should verify valid reset code successfully', async () => {
      const user = await createTestUser();
      const resetCode = '123456';

      const prisma = getPrismaClient();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: resetCode,
          resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const verifyData = mockVerifyResetCodeDto(resetCode);

      const response = await request(httpServer)
        .post('/v1/auth/verify-reset-code')
        .send(verifyData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.headers['set-cookie']).toBeDefined();

      const cookies = getCookiesFromResponse(response);
      const resetCookie = cookies.find((c: string) => c.startsWith('reset-token='));
      expect(resetCookie).toBeDefined();
    });

    it('should fail with invalid reset code', async () => {
      const verifyData = mockVerifyResetCodeDto('invalid-code');

      await request(httpServer).post('/v1/auth/verify-reset-code').send(verifyData).expect(401);
    });

    it('should fail with expired reset code', async () => {
      const user = await createTestUser();
      const resetCode = '123456';

      const prisma = getPrismaClient();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: resetCode,
          resetTokenExpiresAt: new Date(Date.now() - 1000),
        },
      });

      const verifyData = mockVerifyResetCodeDto(resetCode);

      await request(httpServer).post('/v1/auth/verify-reset-code').send(verifyData).expect(401);
    });
  });

  describe('PATCH /v1/auth/reset-password', () => {
    it('should reset password successfully with valid token', async () => {
      const user = await createTestUser();

      const resetToken = jwtService.sign(
        { userId: user.id, email: user.email, purpose: 'reset-password' },
        {
          secret: configService.get('JWT_RESET_SECRET'),
          expiresIn: '15m',
        },
      );

      const resetData = mockResetPasswordDto('NewPassword123!', 'NewPassword123!');

      const response = await request(httpServer)
        .post('/v1/auth/reset-password')
        .set('Cookie', `reset-token=${resetToken}`)
        .send(resetData)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.changePassword',
        expect.objectContaining({
          email: user.email,
        }),
      );
    });

    it('should fail without reset token', async () => {
      const resetData = mockResetPasswordDto('NewPassword123!', 'NewPassword123!');

      await request(httpServer).post('/v1/auth/reset-password').send(resetData).expect(401);
    });

    it('should fail with mismatched passwords', async () => {
      const user = await createTestUser();

      const resetToken = jwtService.sign(
        { sub: user.id, email: user.email },
        {
          secret: configService.get('JWT_RESET_SECRET'),
          expiresIn: '15m',
        },
      );

      const resetData = mockResetPasswordDto('NewPassword123!', 'DifferentPassword123!');

      await request(httpServer)
        .post('/v1/auth/reset-password')
        .set('Cookie', `reset-token=${resetToken}`)
        .send(resetData)
        .expect(400);
    });
  });

  describe('PATCH /v1/auth/change-password', () => {
    it('should change password successfully for authenticated user', async () => {
      const oldPassword = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, oldPassword, false);
      const loginResponse = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      const cookies = getCookiesFromResponse(loginResponse);
      const authCookie = extractAuthCookie(cookies);

      const changeData = mockChangePasswordDto(oldPassword, 'NewPassword123!', 'NewPassword123!');

      const response = await request(httpServer)
        .patch('/v1/auth/change-password')
        .set('Cookie', authCookie)
        .send(changeData)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      const newSignInData = mockSignInDto(user.email, 'NewPassword123!', false);
      await request(httpServer).post('/v1/auth/signin').send(newSignInData).expect(200);
    });

    it('should fail without authentication', async () => {
      const changeData = mockChangePasswordDto(
        'OldPassword123!',
        'NewPassword123!',
        'NewPassword123!',
      );

      await request(httpServer).patch('/v1/auth/change-password').send(changeData).expect(401);
    });

    it('should fail with incorrect old password', async () => {
      const oldPassword = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, oldPassword, false);
      const loginResponse = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      const cookies = getCookiesFromResponse(loginResponse);
      const authCookie = extractAuthCookie(cookies);

      const changeData = mockChangePasswordDto(
        'WrongOldPassword123!',
        'NewPassword123!',
        'NewPassword123!',
      );

      await request(httpServer)
        .patch('/v1/auth/change-password')
        .set('Cookie', authCookie)
        .send(changeData)
        .expect(400);
    });

    it('should fail with mismatched new passwords', async () => {
      const oldPassword = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, oldPassword, false);
      const loginResponse = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      const cookies = getCookiesFromResponse(loginResponse);
      const authCookie = extractAuthCookie(cookies);

      const changeData = mockChangePasswordDto(
        oldPassword,
        'NewPassword123!',
        'DifferentPassword123!',
      );

      await request(httpServer)
        .patch('/v1/auth/change-password')
        .set('Cookie', authCookie)
        .send(changeData)
        .expect(400);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should logout successfully and clear cookie', async () => {
      const password = 'Password123!';
      const user = await createTestUser();

      const signInData = mockSignInDto(user.email, password, false);
      const loginResponse = await request(httpServer)
        .post('/v1/auth/signin')
        .send(signInData)
        .expect(200);

      const loginCookies = getCookiesFromResponse(loginResponse);
      const authCookie = extractAuthCookie(loginCookies);

      const response = await request(httpServer)
        .post('/v1/auth/logout')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      const cookies = getCookiesFromResponse(response);
      const clearedCookie = cookies.find((c: string) => c.startsWith('sprinttacker-session='));

      expect(clearedCookie).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(httpServer).post('/v1/auth/logout').expect(401);
    });
  });
});
