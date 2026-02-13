import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { endOfDay } from 'date-fns';

import { Status } from '@/common/enums/task-status.enum';

import { AnalysisRepository } from './analysis.repository';
import { BasicSummaryResponse, StatusCount } from './dto/get-basic-summary.dto';
import {
  CompletedSummaryResponse,
  DailyCompletedCount,
  GetCompletedSummaryDto,
} from './dto/get-completed-summary.dto';

@Injectable()
export class AnalysisService {
  constructor(private readonly repository: AnalysisRepository) {}

  async getCompletedTasksSummary(
    boardId: string,
    query: GetCompletedSummaryDto,
  ): Promise<CompletedSummaryResponse> {
    const { userId: assignedToId, startDate, endDate } = query;

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date.');
    }

    const finalEndDate = endOfDay(endDate);
    const where: Prisma.TaskWhereInput = {
      status: Status.DONE,
      completedAt: {
        gte: startDate,
        lte: finalEndDate,
      },
      ...(assignedToId ? { assignedToId } : {}),
      list: {
        boardId,
      },
    };

    const completedTasks = await this.repository.findCompletedTasks(where);

    const dailyCountsMap: Record<string, number> = {};

    completedTasks.forEach((task) => {
      if (task.completedAt) {
        const dateKey = task.completedAt.toISOString().split('T')[0];
        dailyCountsMap[dateKey] = (dailyCountsMap[dateKey] || 0) + 1;
      }
    });

    const dailyCounts: DailyCompletedCount[] = Object.keys(dailyCountsMap).map((date) => ({
      date,
      count: dailyCountsMap[date],
    }));

    return {
      total: completedTasks.length,
      dailyCounts: dailyCounts.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getBasicSummary(boardId: string): Promise<BasicSummaryResponse> {
    const tasks = await this.repository.findTasksByBoard(boardId);

    const total = tasks.length;
    const statusCountMap: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };

    tasks.forEach((task) => {
      if (task.status !== (Status.ARCHIVED as string)) {
        statusCountMap[task.status] = (statusCountMap[task.status] || 0) + 1;
      }
    });

    const statusCounts: StatusCount[] = Object.keys(statusCountMap).map((status) => {
      const count = statusCountMap[status];
      const percentage = total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0;
      return {
        status,
        count,
        percentage,
      };
    });

    return {
      total,
      statusCounts,
    };
  }
}
