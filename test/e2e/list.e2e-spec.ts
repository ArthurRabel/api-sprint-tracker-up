import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import {
  mockCreateListDto,
  mockUpdateListDto,
  mockUpdateListPositionDto,
} from '../fixtures/list.fixture';
import { createAuthenticatedUser } from '../helpers/auth.helper';
import { createTestBoard } from '../helpers/board.helper';
import {
  cleanDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  getPrismaClient,
} from '../helpers/database.helper';
import { createTestList } from '../helpers/list.helper';

describe('List E2E Tests', () => {
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

  describe('POST /v1/lists', () => {
    it('should create a new list successfully', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const createListDto = mockCreateListDto(board.id);

      const response = await request(httpServer)
        .post('/v1/lists')
        .set('Cookie', authCookie)
        .send(createListDto)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          title: createListDto.title,
          boardId: board.id,
          position: createListDto.position,
        }),
      );
    });

    it('should fail if user is not a board member', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie } = await createAuthenticatedUser(app); // Another user
      const board = await createTestBoard(owner.id);
      const createListDto = mockCreateListDto(board.id);

      await request(httpServer)
        .post('/v1/lists')
        .set('Cookie', authCookie)
        .send(createListDto)
        .expect(403);
    });

    it('should fail if board does not exist', async () => {
      const { authCookie } = await createAuthenticatedUser(app);
      const createListDto = mockCreateListDto('non-existent-id');

      await request(httpServer)
        .post('/v1/lists')
        .set('Cookie', authCookie)
        .send(createListDto)
        .expect(403);
    });
  });

  describe('GET /v1/lists/board/:boardId', () => {
    it('should return all lists for a board', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      await createTestList(board.id, { title: 'List 1' });
      await createTestList(board.id, { title: 'List 2' });

      const response = await request(httpServer)
        .get(`/v1/lists/board/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /v1/lists/:listId', () => {
    it('should return a specific list', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);

      const response = await request(httpServer)
        .get(`/v1/lists/${list.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: list.id,
          title: list.title,
        }),
      );
    });
  });

  describe('PATCH /v1/lists/:listId', () => {
    it('should update a list', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const updateDto = mockUpdateListDto({ title: 'New Title' });

      const response = await request(httpServer)
        .patch(`/v1/lists/${list.id}`)
        .set('Cookie', authCookie)
        .send(updateDto)
        .expect(200);

      const body = response.body as { title: string };
      expect(body.title).toBe(updateDto.title);
    });
  });

  describe('PATCH /v1/lists/:listId/position', () => {
    it('should update list position', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id, { position: 1 });
      const updatePosDto = mockUpdateListPositionDto(5);

      await request(httpServer)
        .patch(`/v1/lists/${list.id}/position`)
        .set('Cookie', authCookie)
        .send(updatePosDto)
        .expect(200);

      const prisma = getPrismaClient();
      const updatedList = await prisma.list.findUnique({ where: { id: list.id } });
      expect(updatedList?.position).toBe(5);
    });
  });

  describe('DELETE /v1/lists/:listId', () => {
    it('should delete a list', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);

      await request(httpServer)
        .delete(`/v1/lists/${list.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const prisma = getPrismaClient();
      const deletedList = await prisma.list.findUnique({ where: { id: list.id } });
      expect(deletedList).toBeNull();
    });
  });
});
