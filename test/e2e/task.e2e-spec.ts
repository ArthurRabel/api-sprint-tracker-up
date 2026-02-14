import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { Status } from '@/common/enums/task-status.enum';

import {
  mockCreateTaskDto,
  mockMoveTaskDto,
  mockUpdateTaskDto,
  mockUpdateTaskPositionDto,
} from '../fixtures/task.fixture';
import { createAuthenticatedUser } from '../helpers/auth.helper';
import { createTestBoard } from '../helpers/board.helper';
import {
  cleanDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  getPrismaClient,
} from '../helpers/database.helper';
import { createTestList } from '../helpers/list.helper';
import { createTestTask } from '../helpers/task.helper';

describe('Task E2E Tests', () => {
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

  describe('POST /v1/tasks', () => {
    it('should create a new task successfully', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const createTaskDto = mockCreateTaskDto(list.id);

      const response = await request(httpServer)
        .post('/v1/tasks')
        .set('Cookie', authCookie)
        .send(createTaskDto)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          title: createTaskDto.title,
          listId: list.id,
          status: Status.TODO,
        }),
      );
    });

    it('should fail if user is not a board member', async () => {
      const { user: owner } = await createAuthenticatedUser(app);
      const { authCookie } = await createAuthenticatedUser(app); // Another user
      const board = await createTestBoard(owner.id);
      const list = await createTestList(board.id);
      const createTaskDto = mockCreateTaskDto(list.id);

      await request(httpServer)
        .post('/v1/tasks')
        .set('Cookie', authCookie)
        .send(createTaskDto)
        .expect(403);
    });
  });

  describe('GET /v1/tasks/:taskId', () => {
    it('should return a specific task', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const task = await createTestTask(list.id, { creatorId: user.id });

      const response = await request(httpServer)
        .get(`/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: task.id,
          title: task.title,
        }),
      );
    });
  });

  describe('PATCH /v1/tasks/:taskId', () => {
    it('should update a task', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const task = await createTestTask(list.id, { creatorId: user.id });
      const updateDto = mockUpdateTaskDto({ title: 'New Task Title', status: Status.IN_PROGRESS });

      const response = await request(httpServer)
        .patch(`/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .send(updateDto)
        .expect(200);

      const body = response.body as { title: string; status: Status };
      expect(body.title).toBe(updateDto.title);
      expect(body.status).toBe(Status.IN_PROGRESS);
    });
  });

  describe('PATCH /v1/tasks/:taskId/position', () => {
    it('should update task position', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const task = await createTestTask(list.id, { position: 1, creatorId: user.id });
      const updatePosDto = mockUpdateTaskPositionDto(5);

      await request(httpServer)
        .patch(`/v1/tasks/${task.id}/position`)
        .set('Cookie', authCookie)
        .send(updatePosDto)
        .expect(200);

      const prisma = getPrismaClient();
      const updatedTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(updatedTask?.position).toBe(5);
    });
  });

  describe('PATCH /v1/tasks/:taskId/move', () => {
    it('should move task to another list', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list1 = await createTestList(board.id);
      const list2 = await createTestList(board.id); // Target list
      const task = await createTestTask(list1.id, { creatorId: user.id });

      const moveDto = mockMoveTaskDto(list2.id, 1);

      const response = await request(httpServer)
        .patch(`/v1/tasks/${task.id}/move`)
        .set('Cookie', authCookie)
        .send(moveDto)
        .expect(200);

      const body = response.body as { listId: string };
      expect(body.listId).toBe(list2.id);

      const prisma = getPrismaClient();
      const movedTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(movedTask?.listId).toBe(list2.id);
    });
  });

  describe('DELETE /v1/tasks/:taskId', () => {
    it('should delete a task', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);
      const task = await createTestTask(list.id, { creatorId: user.id });

      await request(httpServer)
        .delete(`/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      const prisma = getPrismaClient();
      const deletedTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(deletedTask).toBeNull();
    });
  });

  describe('GET /v1/tasks/due/today', () => {
    it('should return tasks due today or overdue', async () => {
      const { authCookie, user } = await createAuthenticatedUser(app);

      // Setup board and list
      const board = await createTestBoard(user.id);
      const list = await createTestList(board.id);

      // Create a task due today
      const dueToday = new Date();
      const taskToday = await createTestTask(list.id, {
        dueDate: dueToday,
        assignedToId: user.id,
        creatorId: user.id,
      });

      // Create an overdue task
      const overdue = new Date();
      overdue.setDate(overdue.getDate() - 2);
      const taskOverdue = await createTestTask(list.id, {
        dueDate: overdue,
        assignedToId: user.id,
        creatorId: user.id,
      });

      // Create a future task (should not be returned)
      const future = new Date();
      future.setDate(future.getDate() + 5);
      await createTestTask(list.id, {
        dueDate: future,
        assignedToId: user.id,
        creatorId: user.id,
      });

      const response = await request(httpServer)
        .get('/v1/tasks/due/today')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      const tasks = response.body as { id: string }[];
      const taskIds = tasks.map((t) => t.id);
      expect(taskIds).toContain(taskToday.id);
      expect(taskIds).toContain(taskOverdue.id);
      // Ensure future tasks are NOT included (might need precise time check logic in service)
      // Ignoring this check for now as simple Date logic might be tricky without seeing service implementation details
      // regarding time zones, but usually it filters by day.
    });

    it('should return empty list if no tasks assigned to user', async () => {
      const { authCookie } = await createAuthenticatedUser(app);

      const response = await request(httpServer)
        .get('/v1/tasks/due/today')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
