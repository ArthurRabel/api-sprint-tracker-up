import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

import { List, ListMapping, ListWithTasks } from './types/list.types';

@Injectable()
export class ListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createList(data: { boardId: string; title: string; position: number }): Promise<List> {
    const list = await this.prisma.list.create({ data });
    return list as List;
  }

  async createManyLists(
    data: {
      boardId: string;
      externalId?: string;
      title: string;
      position: number;
      isArchived?: boolean;
    }[],
  ): Promise<{ count: number }> {
    return this.prisma.list.createMany({ data });
  }

  async findLastByBoard(boardId: string): Promise<{ position: number } | null> {
    return this.prisma.list.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
  }

  async findAllByBoard(boardId: string): Promise<List[]> {
    const lists = await this.prisma.list.findMany({
      where: { boardId, isArchived: false },
      orderBy: { position: 'asc' },
    });
    return lists as List[];
  }

  async findById(listId: string): Promise<List | null> {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
    });
    return list as List | null;
  }

  async findByIdWithTasks(listId: string): Promise<ListWithTasks | null> {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      include: { tasks: true },
    });
    return list as ListWithTasks | null;
  }

  async findListsForMapping(boardId: string): Promise<ListMapping[]> {
    return this.prisma.list.findMany({
      where: { boardId },
      select: { id: true, externalId: true },
    });
  }

  async updateList(
    listId: string,
    data: { title?: string; position?: number; isArchived?: boolean },
  ): Promise<List> {
    const list = await this.prisma.list.update({
      where: { id: listId },
      data,
    });
    return list as List;
  }

  async shiftPositionsUp(boardId: string, from: number, to: number): Promise<void> {
    await this.prisma.list.updateMany({
      where: {
        boardId,
        position: { gte: from, lt: to },
      },
      data: {
        position: { increment: 1 },
      },
    });
  }

  async shiftPositionsDown(boardId: string, from: number, to: number): Promise<void> {
    await this.prisma.list.updateMany({
      where: {
        boardId,
        position: { gt: from, lte: to },
      },
      data: {
        position: { decrement: 1 },
      },
    });
  }

  async deleteList(listId: string): Promise<List> {
    const list = await this.prisma.list.delete({ where: { id: listId } });
    return list as List;
  }

  async createMany(
    dtos: {
      boardId: string;
      externalId?: string;
      title: string;
      isArchived?: boolean;
    }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lastList = await tx.list.findFirst({
        where: { boardId: dtos[0].boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const startPosition = (lastList?.position ?? 0) + 1;

      return tx.list.createMany({
        data: dtos.map((listDto, index) => ({
          boardId: listDto.boardId,
          externalId: listDto.externalId,
          title: listDto.title,
          position: startPosition + index,
          isArchived: listDto.isArchived,
        })),
      });
    });
  }

  async withTransaction<T>(
    fn: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
