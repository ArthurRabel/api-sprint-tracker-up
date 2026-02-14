import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Status } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { BasicSummaryResponse, StatusCount } from '@/analysis/dto/get-basic-summary.dto';
import { CompletedSummaryResponse } from '@/analysis/dto/get-completed-summary.dto';
import { AppModule } from '@/app.module';

import { createAuthenticatedUser } from '../helpers/auth.helper';
import { createTestBoard } from '../helpers/board.helper';
import { cleanDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/database.helper';
import { createTestList } from '../helpers/list.helper';
import { createTestTask } from '../helpers/task.helper';

describe('Analysis E2E Tests', () => {
  let app: INestApplication;
  let httpServer: Server;

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
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
    jest.clearAllMocks();
  });

  describe('GET /v1/analysis/:boardId', () => {
    it('should return basic summary for a board', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);

      await createTestTask(list.id, { status: Status.TODO, creatorId: user.id });
      await createTestTask(list.id, { status: Status.IN_PROGRESS, creatorId: user.id });
      await createTestTask(list.id, {
        status: Status.DONE,
        creatorId: user.id,
        completedAt: new Date(),
      });

      const response = await request(httpServer)
        .get(`/v1/analysis/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const body = response.body as BasicSummaryResponse;

      expect(body).toHaveProperty('total', 3);
      expect(body.statusCounts).toHaveLength(3);

      const todoCount = body.statusCounts.find((s: StatusCount) => s.status === 'TODO');
      const inProgressCount = body.statusCounts.find(
        (s: StatusCount) => s.status === 'IN_PROGRESS',
      );
      const doneCount = body.statusCounts.find((s: StatusCount) => s.status === 'DONE');

      expect(todoCount).toMatchObject({ count: 1 });
      expect(inProgressCount).toMatchObject({ count: 1 });
      expect(doneCount).toMatchObject({ count: 1 });
    });
  });

  describe('GET /v1/analysis/completed/:boardId', () => {
    it('should return completed tasks summary for a board within date range', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await createTestTask(list.id, {
        status: Status.DONE,
        creatorId: user.id,
        completedAt: today,
      });

      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await createTestTask(list.id, {
        status: Status.DONE,
        creatorId: user.id,
        completedAt: twoDaysAgo,
      });

      await createTestTask(list.id, {
        status: Status.TODO,
        creatorId: user.id,
      });

      const response = await request(httpServer)
        .get(`/v1/analysis/completed/${board.id}`)
        .set('Cookie', authCookie)
        .query({
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        })
        .expect(200);

      const body = response.body as CompletedSummaryResponse;

      expect(body).toHaveProperty('total', 1);
      expect(body.dailyCounts).toHaveLength(1);
      expect(body.dailyCounts[0]).toHaveProperty('date', today.toISOString().split('T')[0]);
      expect(body.dailyCounts[0]).toHaveProperty('count', 1);
    });
  });
});
