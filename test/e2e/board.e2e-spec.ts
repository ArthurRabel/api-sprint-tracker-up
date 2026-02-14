import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { BoardVisibility, Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import { mockCreateBoardDto, mockUpdateBoardDto } from '../fixtures/board.fixture';
import { createAuthenticatedUser } from '../helpers/auth.helper';
import { addMemberToBoard, createTestBoard } from '../helpers/board.helper';
import { cleanDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/database.helper';
import { BoardResponse } from '../types/test.types';

describe('Board E2E Tests', () => {
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

  describe('POST /v1/board', () => {
    it('should create a new board successfully', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const createBoardData = mockCreateBoardDto();

      const response = await request(httpServer)
        .post('/v1/board')
        .set('Cookie', authCookie)
        .send(createBoardData)
        .expect(201);

      const body = response.body as BoardResponse;
      expect(body).toMatchObject({
        title: createBoardData.title,
        description: createBoardData.description,
        visibility: createBoardData.visibility,
        ownerId: user.id,
        isArchived: false,
      });
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('createdAt');
    });

    it('should create board with default visibility PRIVATE', async () => {
      const { authCookie } = await createAuthenticatedUser(app);
      const createBoardData = mockCreateBoardDto({ visibility: undefined });

      const response = await request(httpServer)
        .post('/v1/board')
        .set('Cookie', authCookie)
        .send(createBoardData)
        .expect(201);

      const body = response.body as BoardResponse;
      expect(body.visibility).toBe(BoardVisibility.PRIVATE);
    });

    it('should automatically add owner as ADMIN member', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const createBoardData = mockCreateBoardDto();

      const createResponse = await request(httpServer)
        .post('/v1/board')
        .set('Cookie', authCookie)
        .send(createBoardData)
        .expect(201);

      const createdBoard = createResponse.body as BoardResponse;

      const membersResponse = await request(httpServer)
        .get(`/v1/board/${createdBoard.id}/members`)
        .set('Cookie', authCookie)
        .expect(200);

      const members = membersResponse.body as { userId: string; role: Role }[];
      const ownerMember = members.find((m) => m.userId === user.id);

      expect(ownerMember).toBeDefined();
      expect(ownerMember?.role).toBe(Role.ADMIN);
    });
  });

  describe('GET /v1/board', () => {
    it('should return user boards', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);

      const board1 = await createTestBoard(user.id, { title: 'Board 1' });
      const board2 = await createTestBoard(user.id, { title: 'Board 2' });

      const response = await request(httpServer)
        .get('/v1/board')
        .set('Cookie', authCookie)
        .expect(200);

      const boards = response.body as BoardResponse[];
      expect(boards).toHaveLength(2);
      expect(boards.map((b) => b.id)).toContain(board1.id);
      expect(boards.map((b) => b.id)).toContain(board2.id);
    });

    it('should return boards where user is member', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie, user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .get('/v1/board')
        .set('Cookie', authCookie)
        .expect(200);

      const boards = response.body as BoardResponse[];
      expect(boards.some((b) => b.id === board.id)).toBe(true);
    });
  });

  describe('GET /v1/board/:idBoard', () => {
    it('should return board details for owner', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const body = response.body as BoardResponse;
      expect(body.id).toBe(board.id);
      expect(body.title).toBe(board.title);
      expect(body.ownerId).toBe(user.id);
    });

    it('should return board details for member', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie, user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const body = response.body as BoardResponse;
      expect(body.id).toBe(board.id);
    });
  });

  describe('PATCH /v1/board/:idBoard', () => {
    it('should update board as owner', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);

      const updateData = mockUpdateBoardDto({ title: 'Updated Title' });

      const response = await request(httpServer)
        .patch(`/v1/board/${board.id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      const body = response.body as BoardResponse;
      expect(body.title).toBe('Updated Title');
    });

    it('should update board as ADMIN member', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie, user: admin } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, admin.id, Role.ADMIN);

      const updateData = mockUpdateBoardDto({ description: 'Updated description' });

      const response = await request(httpServer)
        .patch(`/v1/board/${board.id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      const body = response.body as BoardResponse;
      expect(body.description).toBe('Updated description');
    });
  });

  describe('DELETE /v1/board/:idBoard', () => {
    it('should delete board as owner', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);

      const response = await request(httpServer)
        .delete(`/v1/board/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const body = response.body as { message: string };
      expect(body.message).toBe('Board deleted successfully');

      await request(httpServer).get(`/v1/board/${board.id}`).set('Cookie', authCookie).expect(403);
    });
  });

  describe('GET /v1/board/:idBoard/members', () => {
    it('should return board members', async () => {
      const { authCookie, user: owner } = await createAuthenticatedUser(app);
      const { user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}/members`)
        .set('Cookie', authCookie)
        .expect(200);

      const members = response.body as { userId: string; role: Role }[];
      expect(members).toHaveLength(2);
      expect(members.some((m) => m.userId === owner.id && m.role === Role.ADMIN)).toBe(true);
      expect(members.some((m) => m.userId === member.id && m.role === Role.MEMBER)).toBe(true);
    });
  });
});
