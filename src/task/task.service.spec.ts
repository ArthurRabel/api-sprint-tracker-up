import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { Status } from '@/common/enums/task-status.enum';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';
import { Task, TaskOverdue, TaskWithListBoardId } from './types/task.types';

describe('TaskService', () => {
  let service: TaskService;
  let repository: DeepMockProxy<TaskRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  const mockUserId = 'user-123';
  const mockTaskId = 'task-123';
  const mockListId = 'list-123';
  const mockBoardId = 'board-123';

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: mockTaskId,
    externalId: null,
    listId: mockListId,
    creatorId: mockUserId,
    assignedToId: null,
    title: 'Test Task',
    description: null,
    position: 0,
    status: Status.TODO,
    dueDate: null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  });

  const createMockTaskWithList = (
    overrides: Partial<TaskWithListBoardId> = {},
  ): TaskWithListBoardId => ({
    ...createMockTask(),
    list: { boardId: mockBoardId },
    ...overrides,
  });

  beforeEach(async () => {
    repository = mockDeep<TaskRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTaskDto = {
      listId: mockListId,
      title: 'New Task',
      status: Status.TODO,
    };

    it('should create a task and emit event', async () => {
      const mockTask = createMockTask({ title: 'New Task' });
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.countByList.mockResolvedValue(3);
      repository.createTask.mockResolvedValue(mockTask);

      const result = await service.create(mockUserId, createDto);

      expect(repository.findListBoardId).toHaveBeenCalledWith(mockListId);
      expect(repository.countByList).toHaveBeenCalledWith(mockListId);
      expect(repository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: mockUserId,
          listId: mockListId,
          title: 'New Task',
          position: 3,
          status: Status.TODO,
          completedAt: null,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'created task' }),
      );
      expect(result).toEqual(mockTask);
    });

    it('should set completedAt when status is DONE', async () => {
      const doneDto: CreateTaskDto = {
        listId: mockListId,
        title: 'Done Task',
        status: Status.DONE,
      };
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.countByList.mockResolvedValue(0);
      repository.createTask.mockResolvedValue(createMockTask({ status: Status.DONE }));

      await service.create(mockUserId, doneDto);

      expect(repository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findListBoardId.mockResolvedValue(null);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(NotFoundException);
      expect(repository.createTask).not.toHaveBeenCalled();
    });

    it('should normalize assignedToId to null when undefined', async () => {
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.countByList.mockResolvedValue(0);
      repository.createTask.mockResolvedValue(createMockTask());

      await service.create(mockUserId, createDto);

      expect(repository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToId: null }),
      );
    });

    it('should pass assignedToId when provided', async () => {
      const dtoWithAssignee: CreateTaskDto = {
        ...createDto,
        assignedToId: 'assignee-1',
      };
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.countByList.mockResolvedValue(0);
      repository.createTask.mockResolvedValue(createMockTask({ assignedToId: 'assignee-1' }));

      await service.create(mockUserId, dtoWithAssignee);

      expect(repository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToId: 'assignee-1' }),
      );
    });
  });

  describe('createMultipleSameList', () => {
    it('should return early when dto array is empty', async () => {
      await service.createMultipleSameList(mockUserId, mockListId, []);

      expect(repository.countByList).not.toHaveBeenCalled();
      expect(repository.createManyTasks).not.toHaveBeenCalled();
    });

    it('should create multiple tasks and emit event', async () => {
      const dtos: CreateTaskDto[] = [
        { listId: mockListId, title: 'Task 1', status: Status.TODO },
        { listId: mockListId, title: 'Task 2', status: Status.DONE },
      ];
      repository.countByList.mockResolvedValue(2);
      repository.createManyTasks.mockResolvedValue({ count: 2 });
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });

      await service.createMultipleSameList(mockUserId, mockListId, dtos);

      expect(repository.countByList).toHaveBeenCalledWith(mockListId);
      expect(repository.createManyTasks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Task 1', position: 2, completedAt: null }),
          expect.objectContaining({
            title: 'Task 2',
            position: 3,
            completedAt: expect.any(Date),
          }),
        ]),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'imported tasks' }),
      );
    });

    it('should not emit event when list is not found', async () => {
      const dtos: CreateTaskDto[] = [{ listId: mockListId, title: 'Task 1', status: Status.TODO }];
      repository.countByList.mockResolvedValue(0);
      repository.createManyTasks.mockResolvedValue({ count: 1 });
      repository.findListBoardId.mockResolvedValue(null);

      await service.createMultipleSameList(mockUserId, mockListId, dtos);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return task when found', async () => {
      const mockTask = createMockTask();
      repository.findTaskById.mockResolvedValue(mockTask);

      const result = await service.findOne(mockTaskId);

      expect(repository.findTaskById).toHaveBeenCalledWith(mockTaskId);
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      repository.findTaskById.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update task and emit event', async () => {
      const dto: UpdateTaskDto = { title: 'Updated Title' };
      const existingTask = createMockTask();
      const updatedTaskWithList = createMockTaskWithList({ title: 'Updated Title' });
      repository.findTaskById.mockResolvedValue(existingTask);
      repository.updateTask.mockResolvedValue(updatedTaskWithList);

      const result = await service.update(mockTaskId, dto);

      expect(repository.updateTask).toHaveBeenCalledWith(mockTaskId, dto);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'updated task' }),
      );
      expect(result).not.toHaveProperty('list');
    });

    it('should set completedAt when changing to DONE', async () => {
      const dto: UpdateTaskDto = { status: Status.DONE };
      const existingTask = createMockTask({ status: Status.TODO });
      repository.findTaskById.mockResolvedValue(existingTask);
      repository.updateTask.mockResolvedValue(createMockTaskWithList({ status: Status.DONE }));

      await service.update(mockTaskId, dto);

      expect(repository.updateTask).toHaveBeenCalledWith(
        mockTaskId,
        expect.objectContaining({ completedAt: expect.any(Date) }),
      );
    });

    it('should clear completedAt when changing from DONE', async () => {
      const dto: UpdateTaskDto = { status: Status.TODO };
      const existingTask = createMockTask({ status: Status.DONE });
      repository.findTaskById.mockResolvedValue(existingTask);
      repository.updateTask.mockResolvedValue(createMockTaskWithList({ status: Status.TODO }));

      await service.update(mockTaskId, dto);

      expect(repository.updateTask).toHaveBeenCalledWith(
        mockTaskId,
        expect.objectContaining({ completedAt: null }),
      );
    });

    it('should not modify completedAt when status is unchanged', async () => {
      const dto: UpdateTaskDto = { title: 'New Title' };
      const existingTask = createMockTask({ status: Status.TODO });
      repository.findTaskById.mockResolvedValue(existingTask);
      repository.updateTask.mockResolvedValue(createMockTaskWithList());

      await service.update(mockTaskId, dto);

      expect(repository.updateTask).toHaveBeenCalledWith(mockTaskId, { title: 'New Title' });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      repository.findTaskById.mockResolvedValue(null);

      await expect(service.update('nonexistent', { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePosition', () => {
    it('should shift up when moving to lower position', async () => {
      const task = createMockTask({ position: 5 });
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.updateTaskSimple.mockResolvedValue(createMockTask({ position: 2 }));

      await service.updatePosition(mockTaskId, 2);

      expect(repository.shiftPositionsUp).toHaveBeenCalledWith(mockListId, 2, 5);
      expect(repository.shiftPositionsDown).not.toHaveBeenCalled();
      expect(repository.updateTaskSimple).toHaveBeenCalledWith(mockTaskId, { position: 2 });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'updated task position' }),
      );
    });

    it('should shift down when moving to higher position', async () => {
      const task = createMockTask({ position: 2 });
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.updateTaskSimple.mockResolvedValue(createMockTask({ position: 5 }));

      await service.updatePosition(mockTaskId, 5);

      expect(repository.shiftPositionsDown).toHaveBeenCalledWith(mockListId, 2, 5);
      expect(repository.shiftPositionsUp).not.toHaveBeenCalled();
    });

    it('should not shift when position unchanged', async () => {
      const task = createMockTask({ position: 3 });
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.updateTaskSimple.mockResolvedValue(createMockTask({ position: 3 }));

      await service.updatePosition(mockTaskId, 3);

      expect(repository.shiftPositionsUp).not.toHaveBeenCalled();
      expect(repository.shiftPositionsDown).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task does not exist', async () => {
      repository.findTaskById.mockResolvedValue(null);

      await expect(service.updatePosition('nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when list does not exist', async () => {
      const task = createMockTask();
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId.mockResolvedValue(null);

      await expect(service.updatePosition(mockTaskId, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete task with reorder and emit event', async () => {
      const task = createMockTask({ position: 2 });
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId.mockResolvedValue({ boardId: mockBoardId });
      repository.deleteTaskWithReorder.mockResolvedValue(undefined);

      await service.remove(mockTaskId);

      expect(repository.deleteTaskWithReorder).toHaveBeenCalledWith(mockTaskId, mockListId, 2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'deleted task' }),
      );
    });

    it('should throw NotFoundException when task does not exist', async () => {
      repository.findTaskById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repository.deleteTaskWithReorder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findTaskById.mockResolvedValue(createMockTask());
      repository.findListBoardId.mockResolvedValue(null);

      await expect(service.remove(mockTaskId)).rejects.toThrow(NotFoundException);
      expect(repository.deleteTaskWithReorder).not.toHaveBeenCalled();
    });
  });

  describe('findTasksOverdueDate', () => {
    it('should delegate to repository', async () => {
      const mockOverdue: TaskOverdue[] = [];
      repository.findOverdueTasks.mockResolvedValue(mockOverdue);

      const result = await service.findTasksOverdueDate(mockUserId);

      expect(repository.findOverdueTasks).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockOverdue);
    });
  });

  describe('moveTaskToList', () => {
    const newListId = 'list-456';

    it('should move task between lists and emit event', async () => {
      const task = createMockTask({ position: 2 });
      const movedTask = createMockTask({ listId: newListId, position: 0 });
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId
        .mockResolvedValueOnce({ boardId: mockBoardId })
        .mockResolvedValueOnce({ boardId: mockBoardId });
      repository.moveTaskBetweenLists.mockResolvedValue(movedTask);

      const result = await service.moveTaskToList(mockTaskId, newListId, 0);

      expect(repository.moveTaskBetweenLists).toHaveBeenCalledWith(
        mockTaskId,
        mockListId,
        2,
        newListId,
        0,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'moved task between lists' }),
      );
      expect(result).toEqual(movedTask);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      repository.findTaskById.mockResolvedValue(null);

      await expect(service.moveTaskToList('nonexistent', newListId, 0)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when target list does not exist', async () => {
      const task = createMockTask();
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId
        .mockResolvedValueOnce({ boardId: mockBoardId })
        .mockResolvedValueOnce(null);

      await expect(service.moveTaskToList(mockTaskId, 'bad-list', 0)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when source list does not exist', async () => {
      const task = createMockTask();
      repository.findTaskById.mockResolvedValue(task);
      repository.findListBoardId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ boardId: mockBoardId });

      await expect(service.moveTaskToList(mockTaskId, newListId, 0)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
