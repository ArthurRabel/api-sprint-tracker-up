import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { AnalysisRepository, CompletedTaskResult, TaskStatusResult } from './analysis.repository';
import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let repository: DeepMockProxy<AnalysisRepository>;

  const mockBoardId = 'board-123';

  beforeEach(async () => {
    repository = mockDeep<AnalysisRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalysisService, { provide: AnalysisRepository, useValue: repository }],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCompletedTasksSummary', () => {
    const baseQuery = {
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-10'),
    };

    it('should throw BadRequestException when startDate is after endDate', async () => {
      const query = {
        startDate: new Date('2026-02-10'),
        endDate: new Date('2026-02-01'),
      };

      await expect(service.getCompletedTasksSummary(mockBoardId, query)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return total and sorted daily counts', async () => {
      const completedTasks: CompletedTaskResult[] = [
        { completedAt: new Date('2026-02-03T10:00:00Z') },
        { completedAt: new Date('2026-02-03T14:00:00Z') },
        { completedAt: new Date('2026-02-01T08:00:00Z') },
        { completedAt: new Date('2026-02-05T12:00:00Z') },
      ];

      repository.findCompletedTasks.mockResolvedValue(completedTasks);

      const result = await service.getCompletedTasksSummary(mockBoardId, baseQuery);

      expect(result.total).toBe(4);
      expect(result.dailyCounts).toEqual([
        { date: '2026-02-01', count: 1 },
        { date: '2026-02-03', count: 2 },
        { date: '2026-02-05', count: 1 },
      ]);
      expect(repository.findCompletedTasks).toHaveBeenCalledTimes(1);
    });

    it('should return empty daily counts when no tasks are completed', async () => {
      repository.findCompletedTasks.mockResolvedValue([]);

      const result = await service.getCompletedTasksSummary(mockBoardId, baseQuery);

      expect(result.total).toBe(0);
      expect(result.dailyCounts).toEqual([]);
    });

    it('should filter by userId when provided', async () => {
      const userId = 'user-456';
      const query = { ...baseQuery, userId };

      repository.findCompletedTasks.mockResolvedValue([]);

      await service.getCompletedTasksSummary(mockBoardId, query);

      expect(repository.findCompletedTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToId: userId,
        }),
      );
    });

    it('should not include assignedToId in where when userId is not provided', async () => {
      repository.findCompletedTasks.mockResolvedValue([]);

      await service.getCompletedTasksSummary(mockBoardId, baseQuery);

      const calledWith = repository.findCompletedTasks.mock.calls[0][0];
      expect(calledWith).not.toHaveProperty('assignedToId');
    });

    it('should skip tasks with null completedAt in daily counts', async () => {
      const completedTasks: CompletedTaskResult[] = [
        { completedAt: new Date('2026-02-03T10:00:00Z') },
        { completedAt: null },
      ];

      repository.findCompletedTasks.mockResolvedValue(completedTasks);

      const result = await service.getCompletedTasksSummary(mockBoardId, baseQuery);

      expect(result.total).toBe(2);
      expect(result.dailyCounts).toEqual([{ date: '2026-02-03', count: 1 }]);
    });
  });

  describe('getBasicSummary', () => {
    it('should return status counts with percentages', async () => {
      const tasks: TaskStatusResult[] = [
        { status: 'TODO' },
        { status: 'TODO' },
        { status: 'IN_PROGRESS' },
        { status: 'DONE' },
      ];

      repository.findTasksByBoard.mockResolvedValue(tasks);

      const result = await service.getBasicSummary(mockBoardId);

      expect(result.total).toBe(4);
      expect(result.statusCounts).toEqual([
        { status: 'TODO', count: 2, percentage: 50 },
        { status: 'IN_PROGRESS', count: 1, percentage: 25 },
        { status: 'DONE', count: 1, percentage: 25 },
      ]);
      expect(repository.findTasksByBoard).toHaveBeenCalledWith(mockBoardId);
    });

    it('should return zero percentages when board has no tasks', async () => {
      repository.findTasksByBoard.mockResolvedValue([]);

      const result = await service.getBasicSummary(mockBoardId);

      expect(result.total).toBe(0);
      expect(result.statusCounts).toEqual([
        { status: 'TODO', count: 0, percentage: 0 },
        { status: 'IN_PROGRESS', count: 0, percentage: 0 },
        { status: 'DONE', count: 0, percentage: 0 },
      ]);
    });

    it('should exclude ARCHIVED status from counts', async () => {
      const tasks: TaskStatusResult[] = [
        { status: 'TODO' },
        { status: 'ARCHIVED' },
        { status: 'DONE' },
      ];

      repository.findTasksByBoard.mockResolvedValue(tasks);

      const result = await service.getBasicSummary(mockBoardId);

      expect(result.total).toBe(3);

      const todoCount = result.statusCounts.find((s) => s.status === 'TODO');
      const doneCount = result.statusCounts.find((s) => s.status === 'DONE');

      expect(todoCount?.count).toBe(1);
      expect(doneCount?.count).toBe(1);
    });
  });
});
