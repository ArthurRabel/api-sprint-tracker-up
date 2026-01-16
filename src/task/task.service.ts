import { Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { endOfDay } from 'date-fns';

import { BoardGateway } from '@/events/board.gateway';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const list = await this.prisma.list.findUnique({
      where: { id: dto.listId },
      select: { boardId: true },
    });

    if (!list) throw new NotFoundException('List not found');

    const count = await this.prisma.task.count({
      where: { listId: dto.listId },
    });

    const normalizedAssignee = dto.assignedToId === undefined ? null : dto.assignedToId || null;

    const newTask = await this.prisma.task.create({
      data: {
        creatorId: userId,
        listId: dto.listId,
        title: dto.title,
        description: dto.description,
        position: count,
        status: dto.status,
        dueDate: dto.dueDate,
        assignedToId: normalizedAssignee,
        completedAt: String(dto.status) === String(Status.DONE) ? new Date() : null,
      },
    });

    const payload = {
      boardId: list.boardId,
      action: 'created task',
      at: new Date().toISOString(),
    } as const;
    this.boardGateway.emitModifiedInBoard(list.boardId, payload);

    return newTask;
  }

  async createMultipleSameList(userId: string, listId: string, dto: CreateTaskDto[]) {
    if (dto.length === 0) return;

    const currentCount = await this.prisma.task.count({
      where: { listId },
    });

    await this.prisma.task.createMany({
      data: dto.map((task, index) => ({
        listId,
        externalId: task.externalId,
        title: task.title,
        description: task.description || null,
        status: task.status,
        position: currentCount + index,
        isArchived: task.isArchived || false,
        dueDate: task.dueDate || null,
        assignedToId: null,
        completedAt: String(task.status) === String(Status.DONE) ? new Date() : null,
        creatorId: userId,
      })),
    });

    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: { boardId: true },
    });

    if (list) {
      this.boardGateway.emitModifiedInBoard(list.boardId, {
        boardId: list.boardId,
        action: 'imported tasks',
        at: new Date().toISOString(),
      });
    }
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    const task = await this.findOne(id);
    let completedAt: Date | null | undefined = undefined;

    const isStatusChanging = dto.status != null && String(dto.status) !== String(task.status);

    if (isStatusChanging) {
      if (String(dto.status) === String(Status.DONE) && task.status !== Status.DONE) {
        completedAt = new Date();
      } else if (String(dto.status) !== String(Status.DONE) && task.status === Status.DONE) {
        completedAt = null;
      }
    }

    const dataToUpdate = {
      ...dto,
      ...(completedAt !== undefined && { completedAt }),
    };

    const updated = await this.prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: { list: { select: { boardId: true } } },
    });

    const { list: listRelation, ...taskOnly } = updated;
    const boardId = listRelation.boardId;
    const payload = {
      boardId,
      action: 'updated task',
      at: new Date().toISOString(),
    } as const;
    this.boardGateway.emitModifiedInBoard(boardId, payload);

    return taskOnly;
  }

  async updatePosition(id: string, newPosition: number) {
    const task = await this.findOne(id);
    const oldPosition = task.position;

    const list = await this.prisma.list.findUnique({
      where: { id: task.listId },
      select: { boardId: true },
    });
    if (!list) throw new NotFoundException('List not found');

    if (newPosition < oldPosition) {
      await this.prisma.task.updateMany({
        where: {
          listId: task.listId,
          position: { gte: newPosition, lt: oldPosition },
        },
        data: {
          position: { increment: 1 },
        },
      });
    } else if (newPosition > oldPosition) {
      await this.prisma.task.updateMany({
        where: {
          listId: task.listId,
          position: { gt: oldPosition, lte: newPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    }

    await this.prisma.task.update({
      where: { id },
      data: { position: newPosition },
    });

    const payload = {
      boardId: list.boardId,
      action: 'updated task position',
      at: new Date().toISOString(),
    } as const;
    this.boardGateway.emitModifiedInBoard(list.boardId, payload);
  }

  async remove(taskId: string) {
    const taskToDelete = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!taskToDelete) throw new NotFoundException('Task not found');

    const list = await this.prisma.list.findUnique({
      where: { id: taskToDelete.listId },
      select: { boardId: true },
    });
    if (!list) throw new NotFoundException('List not found');

    await this.prisma.$transaction([
      this.prisma.task.delete({
        where: { id: taskId },
      }),
      this.prisma.task.updateMany({
        where: {
          listId: taskToDelete.listId,
          position: {
            gt: taskToDelete.position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      }),
    ]);

    const payload = {
      boardId: list.boardId,
      action: 'deleted task',
      at: new Date().toISOString(),
    } as const;
    this.boardGateway.emitModifiedInBoard(list.boardId, payload);
  }

  async findTasksOverdueDate(userId: string) {
    const today = new Date();

    return this.prisma.task.findMany({
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
  }

  async moveTaskToList(taskId: string, newListId: string, newPosition: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const [sourceList, targetList] = await Promise.all([
      this.prisma.list.findUnique({ where: { id: task.listId } }),
      this.prisma.list.findUnique({ where: { id: newListId } }),
    ]);

    if (!targetList) {
      throw new NotFoundException('Target list not found');
    }
    if (!sourceList) {
      throw new NotFoundException('Source list not found');
    }

    const updatedTask = await this.prisma.$transaction(async (prisma) => {
      await prisma.task.updateMany({
        where: {
          listId: task.listId,
          position: {
            gt: task.position,
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

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          listId: newListId,
          position: newPosition,
        },
      });

      return updatedTask;
    });

    this.boardGateway.emitModifiedInBoard(sourceList.boardId, {
      boardId: sourceList.boardId,
      action: 'moved task between lists',
      at: new Date().toISOString(),
    });

    return updatedTask;
  }
}
