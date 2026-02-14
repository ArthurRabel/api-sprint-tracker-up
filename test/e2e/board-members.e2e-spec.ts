import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

import { mockUpdateMemberRoleDto } from '../fixtures/board.fixture';
import { createAuthenticatedUser } from '../helpers/auth.helper';
import { addMemberToBoard, createTestBoard } from '../helpers/board.helper';
import {
  cleanDatabase,
  getPrismaClient,
  setupTestDatabase,
  teardownTestDatabase,
} from '../helpers/database.helper';
import { BoardMemberResponse, MessageResponse } from '../types/test.types';

describe('Board Members E2E Tests', () => {
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

  describe('DELETE /v1/board/:idBoard/member/:idMember', () => {
    it('should remove member as ADMIN successfully', async () => {
      const { authCookie: adminCookie, user: admin } = await createAuthenticatedUser(app);
      const { user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .delete(`/v1/board/${board.id}/member/${member.id}`)
        .set('Cookie', adminCookie)
        .expect(200);

      const body = response.body as MessageResponse;
      expect(body.message).toBe('Member removed successfully');

      const prisma = getPrismaClient();
      const membership = await prisma.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId: board.id,
            userId: member.id,
          },
        },
      });

      expect(membership).toBeNull();
    });

    it('should allow member to remove themselves', async () => {
      const { user: admin } = await createAuthenticatedUser(app);
      const { authCookie: memberCookie, user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .delete(`/v1/board/${board.id}/member/${member.id}`)
        .set('Cookie', memberCookie)
        .expect(200);

      const body = response.body as MessageResponse;
      expect(body.message).toBe('Member removed successfully');
    });
  });

  describe('PATCH /v1/board/:idBoard/member/:idMember/role', () => {
    it('should update member role as ADMIN', async () => {
      const { authCookie: adminCookie, user: admin } = await createAuthenticatedUser(app);
      const { user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(admin.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const updateData = mockUpdateMemberRoleDto(Role.ADMIN);

      const response = await request(httpServer)
        .patch(`/v1/board/${board.id}/member/${member.id}/role`)
        .set('Cookie', adminCookie)
        .send(updateData)
        .expect(200);

      const body = response.body as BoardMemberResponse;
      expect(body.role).toBe(Role.ADMIN);
    });

    it('should demote ADMIN to MEMBER', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie: ownerCookie } = await createAuthenticatedUser(app, {
        email: owner.email,
        existingUser: true,
      });
      const { user: admin } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, admin.id, Role.ADMIN);

      const updateData = mockUpdateMemberRoleDto(Role.MEMBER);

      const response = await request(httpServer)
        .patch(`/v1/board/${board.id}/member/${admin.id}/role`)
        .set('Cookie', ownerCookie)
        .send(updateData)
        .expect(200);

      const body = response.body as BoardMemberResponse;
      expect(body.role).toBe(Role.MEMBER);
    });
  });

  describe('GET /v1/board/:idBoard/members', () => {
    it('should return all board members with roles', async () => {
      const { authCookie, user: owner } = await createAuthenticatedUser(app);
      const { user: admin } = await createAuthenticatedUser(app);
      const { user: member } = await createAuthenticatedUser(app);
      const { user: observer } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, admin.id, Role.ADMIN);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);
      await addMemberToBoard(board.id, observer.id, Role.OBSERVER);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}/members`)
        .set('Cookie', authCookie)
        .expect(200);

      const members = response.body as BoardMemberResponse[];
      expect(members).toHaveLength(4);

      const ownerMember = members.find((m) => m.userId === owner.id);
      expect(ownerMember?.role).toBe(Role.ADMIN);

      const adminMember = members.find((m) => m.userId === admin.id);
      expect(adminMember?.role).toBe(Role.ADMIN);

      const regularMember = members.find((m) => m.userId === member.id);
      expect(regularMember?.role).toBe(Role.MEMBER);

      const observerMember = members.find((m) => m.userId === observer.id);
      expect(observerMember?.role).toBe(Role.OBSERVER);
    });

    it('should include user details in members response', async () => {
      const { authCookie, user: owner } = await createAuthenticatedUser(app);
      const { user: member } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, member.id, Role.MEMBER);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}/members`)
        .set('Cookie', authCookie)
        .expect(200);

      const members = response.body as BoardMemberResponse[];
      const memberRecord = members.find((m) => m.userId === member.id);

      expect(memberRecord).toBeDefined();
      if (memberRecord?.user) {
        expect(memberRecord.user.email).toBe(member.email);
        expect(memberRecord.user.name).toBe(member.name);
      }
    });

    it('should allow OBSERVER to view members', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie: observerCookie, user: observer } = await createAuthenticatedUser(app);

      const board = await createTestBoard(owner.id);
      await addMemberToBoard(board.id, observer.id, Role.OBSERVER);

      const response = await request(httpServer)
        .get(`/v1/board/${board.id}/members`)
        .set('Cookie', observerCookie)
        .expect(200);

      const members = response.body as BoardMemberResponse[];
      expect(members).toHaveLength(2);
    });
  });
});
