import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { BoardGateway } from '@/events/board.gateway';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Injectable()
export class ListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) { }

  async create(dto: CreateListDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.position === undefined || dto.position === null) {
        const lastList = await tx.list.findFirst({
          where: { boardId: dto[0].boardId },
          orderBy: { position: 'desc' },
          select: { position: true }
        });
        dto.position = (lastList?.position ?? 0) + 1;
      }

      const list = await this.prisma.list.create({
        data: {
          boardId: dto.boardId,
          title: dto.title,
          position: dto.position,
        },
      });

      const payload = {
        boardId: list.boardId,
        action: 'created list',
        at: new Date().toISOString(),
      };
      this.boardGateway.emitModifiedInBoard(list.boardId, payload);

      return list;
    });
  }

  async createMultipleSameBoard(dto: CreateListDto[]) {
    if (dto.length === 0) return;
    
    return this.prisma.$transaction(async (tx) => {
      const lastList = await tx.list.findFirst({
        where: { boardId: dto[0].boardId },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const startPosition = (lastList?.position ?? 0) + 1;

      const createdLists = await tx.list.createMany({
        data: dto.map((listDto, index) => ({
          boardId: listDto.boardId,
          externalId: listDto.externalId,
          title: listDto.title,
          position: startPosition + index,
          isArchived: listDto.isArchived,
        }))
      });

      const payload = {
        boardId: dto[0].boardId,
        action: `created ${dto.length} lists`,
        at: new Date().toISOString(),
      };
      this.boardGateway.emitModifiedInBoard(dto[0].boardId, payload);
      return createdLists;
    })
  };

  async findAll(boardId: string) {
    return this.prisma.list.findMany({
      where: { boardId, isArchived: false },
      orderBy: { position: 'asc' },
    });
  }

  async findOne(listId: string) {
    const list = await this.prisma.list.findUnique({
      where: {
        id: listId,
      },
      include: {
        tasks: true,
      },
    });
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  async findListsForMapping(boardId: string) {
    return this.prisma.list.findMany({
      where: { boardId },
      select: { id: true, externalId: true },
    });
  }

  async update(listId: string, dto: UpdateListDto) {
    const exists = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!exists) throw new NotFoundException('List not found');

    const updated = await this.prisma.list.update({
      where: { id: listId },
      data: dto,
    });

    const payload = {
      boardId: updated.boardId,
      action: 'updated list',
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(updated.boardId, payload);

    return updated;
  }

  async updatePosition(listId: string, newPosition: number) {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('List not found');
    const oldPosition = list.position;

    if (newPosition < oldPosition) {
      await this.prisma.list.updateMany({
        where: {
          boardId: list.boardId,
          position: { gte: newPosition, lt: oldPosition },
        },
        data: {
          position: { increment: 1 },
        },
      });
    } else if (newPosition > oldPosition) {
      await this.prisma.list.updateMany({
        where: {
          boardId: list.boardId,
          position: { gt: oldPosition, lte: newPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    }

    const updatedList = await this.prisma.list.update({
      where: { id: listId },
      data: { position: newPosition },
    });

    const payload = {
      boardId: list.boardId,
      action: 'updated list position',
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(list.boardId, payload);

    return updatedList;
  }

  async remove(listId: string) {
    const exists = await this.prisma.list.findUnique({
      where: { id: listId },
      include: { tasks: true },
    });
    if (!exists) throw new NotFoundException('List not found');

    if (exists.tasks && exists.tasks.length > 0) {
      throw new BadRequestException('Cannot delete a list that contains tasks');
    }

    const deleted = await this.prisma.list.delete({ where: { id: listId } });

    const payload = {
      boardId: deleted.boardId,
      action: 'deleted list',
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(deleted.boardId, payload);

    return deleted;
  }
}
