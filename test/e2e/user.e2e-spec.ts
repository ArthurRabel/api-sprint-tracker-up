import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import { createAuthenticatedUser } from '../helpers/auth.helper';
import {
  cleanDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  getPrismaClient,
} from '../helpers/database.helper';

describe('User E2E Tests', () => {
  let app: INestApplication;
  let httpServer: Server;
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
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);

    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  afterEach(async () => {
    await cleanDatabase();
    jest.clearAllMocks();
  });

  describe('GET /me', () => {
    it('should return the current user profile', async () => {
      const { user, authCookie } = await createAuthenticatedUser(app);

      const response = await request(httpServer)
        .get('/v1/me')
        .set('Cookie', [authCookie])
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: user.id,
          name: user.name,
          email: user.email,
          userName: user.userName,
        }),
      );

      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should fail with 401 if not authenticated', async () => {
      await request(httpServer).get('/v1/me').expect(401);
    });
  });

  describe('PUT /me', () => {
    it('should update the user profile', async () => {
      const { user, authCookie } = await createAuthenticatedUser(app);
      const updateData = {
        name: 'Updated Name',
        userName: 'updateduser',
      };

      const response = await request(httpServer)
        .put('/v1/me')
        .set('Cookie', [authCookie])
        .send(updateData)
        .expect(200);

      const body = response.body as { message: string; data: Partial<typeof updateData> };
      expect(body.message).toBe('User updated successfully.');
      expect(body.data).toEqual(expect.objectContaining(updateData));

      const prisma = getPrismaClient();
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.name).toBe(updateData.name);
      expect(updatedUser?.userName).toBe(updateData.userName);
    });

    it('should return 400 for invalid data', async () => {
      const { authCookie } = await createAuthenticatedUser(app);

      await request(httpServer)
        .put('/v1/me')
        .set('Cookie', [authCookie])
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('DELETE /me', () => {
    it('should delete the user account', async () => {
      const { user, authCookie } = await createAuthenticatedUser(app);

      const response = await request(httpServer)
        .delete('/v1/me')
        .set('Cookie', [authCookie])
        .expect(200);

      const body = response.body as { message: string };
      expect(body.message).toBe('Account deleted successfully.');
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.deleted', expect.anything());

      const prisma = getPrismaClient();
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });
  });

  describe('GET /me/notifications', () => {
    it('should return an empty list of notifications initially', async () => {
      const { authCookie } = await createAuthenticatedUser(app);

      const response = await request(httpServer)
        .get('/v1/me/notifications')
        .set('Cookie', [authCookie])
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });
});
