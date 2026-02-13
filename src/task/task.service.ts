import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Status } from '@/common/enums/task-status.enum';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskRepository } from './task.repository';
import { Task, TaskOverdue } from './types/task.types';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const list = await this.taskRepository.findListBoardId(dto.listId);

    if (!list) throw new NotFoundException('List not found');

    const count = await this.taskRepository.countByList(dto.listId);

    const normalizedAssignee = dto.assignedToId === undefined ? null : dto.assignedToId || null;

    const newTask = await this.taskRepository.createTask({
      creatorId: userId,
      listId: dto.listId,
      title: dto.title,
      description: dto.description,
      position: count,
      status: dto.status,
      dueDate: dto.dueDate,
      assignedToId: normalizedAssignee,
      completedAt: String(dto.status) === String(Status.DONE) ? new Date() : null,
    });

    const payload = {
      boardId: list.boardId,
      action: 'created task',
      at: new Date().toISOString(),
    } as const;
    this.eventEmitter.emit('board.modified', payload);

    return newTask;
  }

  async createMultipleSameList(userId: string, listId: string, dto: CreateTaskDto[]) {
    if (dto.length === 0) return;

    const currentCount = await this.taskRepository.countByList(listId);

    await this.taskRepository.createManyTasks(
      dto.map((task, index) => ({
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
    );

    const list = await this.taskRepository.findListBoardId(listId);

    if (list) {
      this.eventEmitter.emit('board.modified', {
        boardId: list.boardId,
        action: 'imported tasks',
        at: new Date().toISOString(),
      });
    }
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findTaskById(id);
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

    const updated = await this.taskRepository.updateTask(id, dataToUpdate);

    const { list: listRelation, ...taskOnly } = updated;
    const boardId = listRelation.boardId;
    const payload = {
      boardId,
      action: 'updated task',
      at: new Date().toISOString(),
    } as const;
    this.eventEmitter.emit('board.modified', payload);

    return taskOnly;
  }

  async updatePosition(id: string, newPosition: number) {
    const task = await this.findOne(id);
    const oldPosition = task.position;

    const list = await this.taskRepository.findListBoardId(task.listId);
    if (!list) throw new NotFoundException('List not found');

    if (newPosition < oldPosition) {
      await this.taskRepository.shiftPositionsUp(task.listId, newPosition, oldPosition);
    } else if (newPosition > oldPosition) {
      await this.taskRepository.shiftPositionsDown(task.listId, oldPosition, newPosition);
    }

    await this.taskRepository.updateTaskSimple(id, { position: newPosition });

    const payload = {
      boardId: list.boardId,
      action: 'updated task position',
      at: new Date().toISOString(),
    } as const;
    this.eventEmitter.emit('board.modified', payload);
  }

  async remove(taskId: string) {
    const taskToDelete = await this.taskRepository.findTaskById(taskId);

    if (!taskToDelete) throw new NotFoundException('Task not found');

    const list = await this.taskRepository.findListBoardId(taskToDelete.listId);
    if (!list) throw new NotFoundException('List not found');

    await this.taskRepository.deleteTaskWithReorder(
      taskId,
      taskToDelete.listId,
      taskToDelete.position,
    );

    const payload = {
      boardId: list.boardId,
      action: 'deleted task',
      at: new Date().toISOString(),
    } as const;
    this.eventEmitter.emit('board.modified', payload);
  }

  async findTasksOverdueDate(userId: string): Promise<TaskOverdue[]> {
    return this.taskRepository.findOverdueTasks(userId);
  }

  async moveTaskToList(taskId: string, newListId: string, newPosition: number) {
    const task = await this.taskRepository.findTaskById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const [sourceList, targetList] = await Promise.all([
      this.taskRepository.findListBoardId(task.listId),
      this.taskRepository.findListBoardId(newListId),
    ]);

    if (!targetList) {
      throw new NotFoundException('Target list not found');
    }
    if (!sourceList) {
      throw new NotFoundException('Source list not found');
    }

    const updatedTask = await this.taskRepository.moveTaskBetweenLists(
      taskId,
      task.listId,
      task.position,
      newListId,
      newPosition,
    );

    this.eventEmitter.emit('board.modified', {
      boardId: sourceList.boardId,
      action: 'moved task between lists',
      at: new Date().toISOString(),
    });

    return updatedTask;
  }
}
