import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { Status } from '@/common/enums/task-status.enum';

import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListRepository } from './list.repository';
import { ListService } from './list.service';
import { List, ListWithTasks } from './types/list.types';

describe('ListService', () => {
  let service: ListService;
  let repository: DeepMockProxy<ListRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  const mockBoardId = 'board-123';
  const mockListId = 'list-123';

  const createMockList = (overrides: Partial<List> = {}): List => ({
    id: mockListId,
    externalId: null,
    boardId: mockBoardId,
    title: 'Test List',
    position: 1,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockListWithTasks = (overrides: Partial<ListWithTasks> = {}): ListWithTasks => ({
    ...createMockList(),
    tasks: [],
    ...overrides,
  });

  beforeEach(async () => {
    repository = mockDeep<ListRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
        { provide: ListRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ListService>(ListService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateListDto = {
      boardId: mockBoardId,
      title: 'New List',
      position: 3,
    };

    it('should create a list with explicit position', async () => {
      const mockList = createMockList({ title: createDto.title, position: 3 });
      repository.createList.mockResolvedValue(mockList);

      const result = await service.create(createDto);

      expect(repository.createList).toHaveBeenCalledWith({
        boardId: mockBoardId,
        title: 'New List',
        position: 3,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'created list' }),
      );
      expect(result).toEqual(mockList);
    });

    it('should auto-calculate position when not provided', async () => {
      const dtoNoPosition: CreateListDto = {
        boardId: mockBoardId,
        title: 'Auto Position',
      };
      repository.findLastByBoard.mockResolvedValue({ position: 5 });
      const mockList = createMockList({ title: 'Auto Position', position: 6 });
      repository.createList.mockResolvedValue(mockList);

      await service.create(dtoNoPosition);

      expect(repository.findLastByBoard).toHaveBeenCalledWith(mockBoardId);
      expect(repository.createList).toHaveBeenCalledWith(expect.objectContaining({ position: 6 }));
    });

    it('should default position to 1 when board has no lists', async () => {
      const dtoNoPosition: CreateListDto = {
        boardId: mockBoardId,
        title: 'First List',
      };
      repository.findLastByBoard.mockResolvedValue(null);
      const mockList = createMockList({ position: 1 });
      repository.createList.mockResolvedValue(mockList);

      await service.create(dtoNoPosition);

      expect(repository.createList).toHaveBeenCalledWith(expect.objectContaining({ position: 1 }));
    });
  });

  describe('createMultipleSameBoard', () => {
    it('should return early when dto array is empty', async () => {
      const result = await service.createMultipleSameBoard([]);

      expect(result).toBeUndefined();
      expect(repository.createMany).not.toHaveBeenCalled();
    });

    it('should delegate to repository for batch creation', async () => {
      const dtos: CreateListDto[] = [
        { boardId: mockBoardId, title: 'List 1' },
        { boardId: mockBoardId, title: 'List 2' },
      ];
      repository.createMany.mockResolvedValue({ count: 2 });

      await service.createMultipleSameBoard(dtos);

      expect(repository.createMany).toHaveBeenCalledWith(dtos);
    });
  });

  describe('findAll', () => {
    it('should return all lists for a board', async () => {
      const mockLists = [createMockList(), createMockList({ id: 'list-456', position: 2 })];
      repository.findAllByBoard.mockResolvedValue(mockLists);

      const result = await service.findAll(mockBoardId);

      expect(repository.findAllByBoard).toHaveBeenCalledWith(mockBoardId);
      expect(result).toEqual(mockLists);
    });
  });

  describe('findOne', () => {
    it('should return list with tasks when found', async () => {
      const mockList = createMockListWithTasks({
        tasks: [
          {
            id: 'task-1',
            externalId: null,
            listId: mockListId,
            creatorId: 'user-1',
            assignedToId: null,
            title: 'Task 1',
            description: null,
            position: 0,
            status: Status.TODO,
            dueDate: null,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
          },
        ],
      });
      repository.findByIdWithTasks.mockResolvedValue(mockList);

      const result = await service.findOne(mockListId);

      expect(repository.findByIdWithTasks).toHaveBeenCalledWith(mockListId);
      expect(result).toEqual(mockList);
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findByIdWithTasks.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findListsForMapping', () => {
    it('should return list mappings', async () => {
      const mockMappings = [
        { id: 'list-1', externalId: 'ext-1' },
        { id: 'list-2', externalId: null },
      ];
      repository.findListsForMapping.mockResolvedValue(mockMappings);

      const result = await service.findListsForMapping(mockBoardId);

      expect(repository.findListsForMapping).toHaveBeenCalledWith(mockBoardId);
      expect(result).toEqual(mockMappings);
    });
  });

  describe('update', () => {
    const updateDto: UpdateListDto = { title: 'Updated Title' };

    it('should update list and emit event', async () => {
      const existingList = createMockList();
      const updatedList = createMockList({ title: 'Updated Title' });
      repository.findById.mockResolvedValue(existingList);
      repository.updateList.mockResolvedValue(updatedList);

      const result = await service.update(mockListId, updateDto);

      expect(repository.findById).toHaveBeenCalledWith(mockListId);
      expect(repository.updateList).toHaveBeenCalledWith(mockListId, updateDto);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'updated list' }),
      );
      expect(result).toEqual(updatedList);
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
      expect(repository.updateList).not.toHaveBeenCalled();
    });
  });

  describe('updatePosition', () => {
    it('should shift positions up when moving to lower position', async () => {
      const list = createMockList({ position: 5 });
      const updatedList = createMockList({ position: 2 });
      repository.findById.mockResolvedValue(list);
      repository.updateList.mockResolvedValue(updatedList);

      const result = await service.updatePosition(mockListId, 2);

      expect(repository.shiftPositionsUp).toHaveBeenCalledWith(mockBoardId, 2, 5);
      expect(repository.shiftPositionsDown).not.toHaveBeenCalled();
      expect(repository.updateList).toHaveBeenCalledWith(mockListId, { position: 2 });
      expect(result).toEqual(updatedList);
    });

    it('should shift positions down when moving to higher position', async () => {
      const list = createMockList({ position: 2 });
      const updatedList = createMockList({ position: 5 });
      repository.findById.mockResolvedValue(list);
      repository.updateList.mockResolvedValue(updatedList);

      const result = await service.updatePosition(mockListId, 5);

      expect(repository.shiftPositionsDown).toHaveBeenCalledWith(mockBoardId, 2, 5);
      expect(repository.shiftPositionsUp).not.toHaveBeenCalled();
      expect(result).toEqual(updatedList);
    });

    it('should not shift positions when position unchanged', async () => {
      const list = createMockList({ position: 3 });
      const updatedList = createMockList({ position: 3 });
      repository.findById.mockResolvedValue(list);
      repository.updateList.mockResolvedValue(updatedList);

      await service.updatePosition(mockListId, 3);

      expect(repository.shiftPositionsUp).not.toHaveBeenCalled();
      expect(repository.shiftPositionsDown).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updatePosition('nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it('should emit board event after position update', async () => {
      const list = createMockList({ position: 1 });
      repository.findById.mockResolvedValue(list);
      repository.updateList.mockResolvedValue(createMockList({ position: 3 }));

      await service.updatePosition(mockListId, 3);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'updated list position' }),
      );
    });
  });

  describe('remove', () => {
    it('should delete list and emit event', async () => {
      const listWithNoTasks = createMockListWithTasks({ tasks: [] });
      const deletedList = createMockList();
      repository.findByIdWithTasks.mockResolvedValue(listWithNoTasks);
      repository.deleteList.mockResolvedValue(deletedList);

      const result = await service.remove(mockListId);

      expect(repository.findByIdWithTasks).toHaveBeenCalledWith(mockListId);
      expect(repository.deleteList).toHaveBeenCalledWith(mockListId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({ action: 'deleted list' }),
      );
      expect(result).toEqual(deletedList);
    });

    it('should throw NotFoundException when list does not exist', async () => {
      repository.findByIdWithTasks.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repository.deleteList).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when list has tasks', async () => {
      const listWithTasks = createMockListWithTasks({
        tasks: [
          {
            id: 'task-1',
            externalId: null,
            listId: mockListId,
            creatorId: 'user-1',
            assignedToId: null,
            title: 'Task',
            description: null,
            position: 0,
            status: Status.TODO,
            dueDate: null,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
          },
        ],
      });
      repository.findByIdWithTasks.mockResolvedValue(listWithTasks);

      await expect(service.remove(mockListId)).rejects.toThrow(BadRequestException);
      expect(repository.deleteList).not.toHaveBeenCalled();
    });
  });
});
