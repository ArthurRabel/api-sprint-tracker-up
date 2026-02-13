import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListRepository } from './list.repository';
import { List, ListMapping, ListWithTasks } from './types/list.types';

@Injectable()
export class ListService {
  constructor(
    private readonly listRepository: ListRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateListDto): Promise<List> {
    if (dto.position === undefined || dto.position === null) {
      const lastList = await this.listRepository.findLastByBoard(dto.boardId);
      dto.position = (lastList?.position ?? 0) + 1;
    }

    const list = await this.listRepository.createList({
      boardId: dto.boardId,
      title: dto.title,
      position: dto.position,
    });

    const payload = {
      boardId: list.boardId,
      action: 'created list',
      at: new Date().toISOString(),
    };
    this.eventEmitter.emit('board.modified', payload);

    return list;
  }

  async createMultipleSameBoard(dto: CreateListDto[]) {
    if (dto.length === 0) return;

    const createdLists = await this.listRepository.createMany(dto);

    const payload = {
      boardId: dto[0].boardId,
      action: `created ${dto.length} lists`,
      at: new Date().toISOString(),
    };
    this.eventEmitter.emit('board.modified', payload);
    return createdLists;
  }

  async findAll(boardId: string): Promise<List[]> {
    return this.listRepository.findAllByBoard(boardId);
  }

  async findOne(listId: string): Promise<ListWithTasks> {
    const list = await this.listRepository.findByIdWithTasks(listId);
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  async findListsForMapping(boardId: string): Promise<ListMapping[]> {
    return this.listRepository.findListsForMapping(boardId);
  }

  async update(listId: string, dto: UpdateListDto): Promise<List> {
    const exists = await this.listRepository.findById(listId);
    if (!exists) throw new NotFoundException('List not found');

    const updated = await this.listRepository.updateList(listId, dto);

    const payload = {
      boardId: updated.boardId,
      action: 'updated list',
      at: new Date().toISOString(),
    };
    this.eventEmitter.emit('board.modified', payload);

    return updated;
  }

  async updatePosition(listId: string, newPosition: number): Promise<List> {
    const list = await this.listRepository.findById(listId);
    if (!list) throw new NotFoundException('List not found');
    const oldPosition = list.position;

    if (newPosition < oldPosition) {
      await this.listRepository.shiftPositionsUp(list.boardId, newPosition, oldPosition);
    } else if (newPosition > oldPosition) {
      await this.listRepository.shiftPositionsDown(list.boardId, oldPosition, newPosition);
    }

    const updatedList = await this.listRepository.updateList(listId, { position: newPosition });

    const payload = {
      boardId: list.boardId,
      action: 'updated list position',
      at: new Date().toISOString(),
    };
    this.eventEmitter.emit('board.modified', payload);

    return updatedList;
  }

  async remove(listId: string): Promise<List> {
    const exists = await this.listRepository.findByIdWithTasks(listId);
    if (!exists) throw new NotFoundException('List not found');

    if (exists.tasks && exists.tasks.length > 0) {
      throw new BadRequestException('Cannot delete a list that contains tasks');
    }

    const deleted = await this.listRepository.deleteList(listId);

    const payload = {
      boardId: deleted.boardId,
      action: 'deleted list',
      at: new Date().toISOString(),
    };
    this.eventEmitter.emit('board.modified', payload);

    return deleted;
  }
}
