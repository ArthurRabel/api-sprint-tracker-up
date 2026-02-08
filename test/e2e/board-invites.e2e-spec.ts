import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Role, statusInvite } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import { mockInviteBoardDto, mockResponseInviteBoardDto } from '../fixtures/board.fixture';
import { createAuthenticatedUser } from '../helpers/auth.helper';
import { addMemberToBoard, createTestBoard, createTestInvite } from '../helpers/board.helper';
import {
  cleanDatabase,
  getPrismaClient,
  setupTestDatabase,
  teardownTestDatabase,
} from '../helpers/database.helper';
import { MessageResponse } from '../types/test.types';

describe('Board Invites E2E Tests', () => {
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

  describe('POST /v1/board/invite/:boardId', () => {
    it('should send invite as ADMIN successfully', async () => {
      const { authCookie, user: admin } = await createAuthenticatedUser(app);
      const { user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      const inviteData = mockInviteBoardDto(recipient.userName, Role.MEMBER);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', authCookie)
        .send(inviteData)
        .expect(201);

      const body = response.body as MessageResponse;
      expect(body.message).toBe('Invite sent successfully');

      const prisma = getPrismaClient();
      const invite = await prisma.invite.findFirst({
        where: {
          boardId: board.id,
          recipientId: recipient.id,
          statusInvite: statusInvite.PENDING,
        },
      });

      expect(invite).toBeDefined();
      expect(invite?.role).toBe(Role.MEMBER);
    });

    it('should fail when inviting non-existent user', async () => {
      const { authCookie, user: admin } = await createAuthenticatedUser(app);
      const board = await createTestBoard(admin.id);
      const inviteData = mockInviteBoardDto('nonexistent_user', Role.MEMBER);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', authCookie)
        .send(inviteData)
        .expect(404);

      const body = response.body as { message: string };
      expect(body.message).toBe('Recipient not found');
    });

    it('should fail when inviting existing member', async () => {
      const { authCookie, user: admin } = await createAuthenticatedUser(app);
      const { user: existingMember } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await addMemberToBoard(board.id, existingMember.id, Role.MEMBER);

      const inviteData = mockInviteBoardDto(existingMember.userName, Role.MEMBER);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', authCookie)
        .send(inviteData)
        .expect(400);

      const body = response.body as { message: string };
      expect(body.message).toBe('This user is already a member of the board');
    });

    it('should fail when pending invite exists', async () => {
      const { authCookie, user: admin } = await createAuthenticatedUser(app);
      const { user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await createTestInvite(board.id, admin.id, recipient.id, Role.MEMBER);

      const inviteData = mockInviteBoardDto(recipient.userName, Role.OBSERVER);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', authCookie)
        .send(inviteData)
        .expect(400);

      const body = response.body as { message: string };
      expect(body.message).toBe('There is already a pending invite for this user');
    });

    it('should fail for MEMBER role sending invite', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: memberCookie, user: member } = await createAuthenticatedUser(app);
      const { user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const inviteData = mockInviteBoardDto(recipient.userName, Role.MEMBER);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', memberCookie)
        .send(inviteData)
        .expect(403);

      const body = response.body as { message: string };
      expect(body.message).toBe('Action not allowed for your role on this board');
    });

    it('should fail for non-member', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie } = await createAuthenticatedUser(app);
      const { user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);

      const inviteData = mockInviteBoardDto(recipient.userName, Role.MEMBER);

      await request(httpServer)
        .post(`/v1/board/invite/${board.id}`)
        .set('Cookie', authCookie)
        .send(inviteData)
        .expect(403);
    });
  });

  describe('POST /v1/board/invite/:boardId/response', () => {
    it('should accept invite and add user as member', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: recipientCookie, user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      const invite = await createTestInvite(board.id, admin.id, recipient.id, Role.MEMBER);

      const responseData = mockResponseInviteBoardDto(invite.id, true);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}/response`)
        .set('Cookie', recipientCookie)
        .send(responseData)
        .expect(201);

      const body = response.body as MessageResponse;
      expect(body.message).toBe('Invite accepted successfully');

      const prisma = getPrismaClient();
      const membership = await prisma.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId: board.id,
            userId: recipient.id,
          },
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe(Role.MEMBER);

      const updatedInvite = await prisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite).toBeNull();
    });

    it('should reject invite successfully', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: recipientCookie, user: recipient } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      const invite = await createTestInvite(board.id, admin.id, recipient.id, Role.MEMBER);

      const responseData = mockResponseInviteBoardDto(invite.id, false);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}/response`)
        .set('Cookie', recipientCookie)
        .send(responseData)
        .expect(201);

      const body = response.body as MessageResponse;
      expect(body.message).toBe('Invite declined successfully');

      const prisma = getPrismaClient();
      const updatedInvite = await prisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite).toBeNull();

      const membership = await prisma.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId: board.id,
            userId: recipient.id,
          },
        },
      });
      expect(membership).toBeNull();
    });

    it('should fail when responding to invite for another user', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { user: recipient } = await createAuthenticatedUser(app);
      const { authCookie: otherCookie } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      const invite = await createTestInvite(board.id, admin.id, recipient.id, Role.MEMBER);

      const responseData = mockResponseInviteBoardDto(invite.id, true);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}/response`)
        .set('Cookie', otherCookie)
        .send(responseData)
        .expect(403);

      const body = response.body as { message: string };
      expect(body.message).toBe('You do not have permission to accept this invite');
    });

    it('should fail for non-existent invite', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: recipientCookie } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      const responseData = mockResponseInviteBoardDto('non-existent-id', true);

      const response = await request(httpServer)
        .post(`/v1/board/invite/${board.id}/response`)
        .set('Cookie', recipientCookie)
        .send(responseData)
        .expect(404);

      const body = response.body as { message: string };
      expect(body.message).toBe('Invite not found');
    });
  });

  describe('GET /v1/me/notifications', () => {
    it('should return pending invites for authenticated user', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: recipientCookie, user: recipient } = await createAuthenticatedUser(app);

      const board1 = await createTestBoard(admin.id);
      const board2 = await createTestBoard(admin.id);

      await createTestInvite(board1.id, admin.id, recipient.id, Role.MEMBER);
      await createTestInvite(board2.id, admin.id, recipient.id, Role.ADMIN);

      const response = await request(httpServer)
        .get('/v1/me/notifications')
        .set('Cookie', recipientCookie)
        .expect(200);

      const notifications = response.body as Array<{
        id: string;
        createdAt: string;
        statusInvite: string;
        role: string;
        sender: {
          id: string;
          name: string;
          userName: string;
        };
        board: {
          id: string;
          title: string;
        };
      }>;

      expect(notifications.length).toBeGreaterThanOrEqual(2);
      expect(notifications.every((n) => n.board && n.sender)).toBe(true);
    });

    it('should return empty array when user has no invites', async () => {
      const { authCookie } = await createAuthenticatedUser(app);

      const response = await request(httpServer)
        .get('/v1/me/notifications')
        .set('Cookie', authCookie)
        .expect(200);

      const notifications = response.body as Array<unknown>;
      expect(notifications).toHaveLength(0);
    });

    it('should fail without authentication', async () => {
      await request(httpServer).get('/v1/me/notifications').expect(401);
    });
  });
});
