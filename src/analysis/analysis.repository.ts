import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

export interface CompletedTaskResult {
  completedAt: Date | null;
}

export interface TaskStatusResult {
  status: string;
}

@Injectable()
export class AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCompletedTasks(where: Prisma.TaskWhereInput): Promise<CompletedTaskResult[]> {
    return this.prisma.task.findMany({
      where,
      select: {
        completedAt: true,
      },
    });
  }

  async findTasksByBoard(boardId: string): Promise<TaskStatusResult[]> {
    return this.prisma.task.findMany({
      where: {
        list: {
          boardId,
        },
        isArchived: false,
      },
      select: {
        status: true,
      },
    });
  }
}
