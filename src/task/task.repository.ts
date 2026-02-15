import { Injectable } from '@nestjs/common';
import { endOfDay } from 'date-fns';

import { Status } from '@/common/enums/task-status.enum';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { Task, TaskOverdue, TaskWithListBoardId } from './types/task.types';

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(data: {
    creatorId: string;
    listId: string;
    title: string;
    description?: string | null;
    position: number;
    status: Status;
    dueDate?: Date | null;
    assignedToId: string | null;
    completedAt: Date | null;
  }): Promise<Task> {
    const task = await this.prisma.task.create({ data });
    return task as Task;
  }

  async createManyTasks(
    data: {
      listId: string;
      externalId?: string;
      title: string;
      description?: string | null;
      status: Status;
      position: number;
      isArchived?: boolean;
      dueDate?: Date | null;
      assignedToId: string | null;
      completedAt: Date | null;
      creatorId: string;
    }[],
  ): Promise<{ count: number }> {
    return this.prisma.task.createMany({ data });
  }

  async findTaskById(id: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    return task as Task | null;
  }

  async updateTask(id: string, data: Record<string, unknown>): Promise<TaskWithListBoardId> {
    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: { list: { select: { boardId: true } } },
    });
    return task as unknown as TaskWithListBoardId;
  }

  async updateTaskSimple(id: string, data: Record<string, unknown>): Promise<Task> {
    const task = await this.prisma.task.update({
      where: { id },
      data,
    });
    return task as Task;
  }

  async countByList(listId: string): Promise<number> {
    return this.prisma.task.count({ where: { listId } });
  }

  async findListBoardId(listId: string): Promise<{ boardId: string } | null> {
    return this.prisma.list.findUnique({
      where: { id: listId },
      select: { boardId: true },
    });
  }

  async shiftPositionsUp(listId: string, from: number, to: number): Promise<void> {
    await this.prisma.task.updateMany({
      where: {
        listId,
        position: { gte: from, lt: to },
      },
      data: {
        position: { increment: 1 },
      },
    });
  }

  async shiftPositionsDown(listId: string, from: number, to: number): Promise<void> {
    await this.prisma.task.updateMany({
      where: {
        listId,
        position: { gt: from, lte: to },
      },
      data: {
        position: { decrement: 1 },
      },
    });
  }

  async deleteTaskWithReorder(taskId: string, listId: string, position: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.task.delete({
        where: { id: taskId },
      }),
      this.prisma.task.updateMany({
        where: {
          listId,
          position: {
            gt: position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      }),
    ]);
  }

  async findOverdueTasks(userId: string): Promise<TaskOverdue[]> {
    const today = new Date();

    const tasks = await this.prisma.task.findMany({
      where: {
        creatorId: userId,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: {
          lte: endOfDay(today),
        },
      },
      include: {
        list: {
          include: {
            board: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return tasks as unknown as TaskOverdue[];
  }

  async moveTaskBetweenLists(
    taskId: string,
    oldListId: string,
    oldPosition: number,
    newListId: string,
    newPosition: number,
  ): Promise<Task> {
    const updatedTask = await this.prisma.$transaction(async (prisma) => {
      await prisma.task.updateMany({
        where: {
          listId: oldListId,
          position: {
            gt: oldPosition,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      });

      await prisma.task.updateMany({
        where: {
          listId: newListId,
          position: {
            gte: newPosition,
          },
        },
        data: {
          position: {
            increment: 1,
          },
        },
      });

      const updated = await prisma.task.update({
        where: { id: taskId },
        data: {
          listId: newListId,
          position: newPosition,
        },
      });

      return updated;
    });

    return updatedTask as Task;
  }
}
