import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { BoardRoleGuard } from '@/auth/guards/board-role.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { BoardRoles } from '@/auth/strategy/decorators/board-rules.decorator';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';

import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskOtherListDto } from './dto/move-task-other-list.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  CreateTaskDocs,
  FindOneTaskDocs,
  GetTodayOrOverdueTasksDocs,
  MoveTaskDocs,
  RemoveTaskDocs,
  UpdateTaskDocs,
  UpdateTaskPositionDocs,
} from './task.docs';
import { TaskService } from './task.service';

@ApiCookieAuth()
@ApiTags('Tasks')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @CreateTaskDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.taskService.create(user.id, dto);
  }

  @FindOneTaskDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.taskService.findOne(taskId);
  }

  @UpdateTaskDocs()
  @Patch(':taskId')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  update(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.taskService.update(taskId, dto);
  }

  @UpdateTaskPositionDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  @Patch(':taskId/position')
  updatePosition(@Param('taskId') taskId: string, @Body() dto: UpdatePositionDto) {
    return this.taskService.updatePosition(taskId, dto.newPosition);
  }

  @RemoveTaskDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  @Delete(':taskId')
  remove(@Param('taskId') taskId: string) {
    return this.taskService.remove(taskId);
  }

  @GetTodayOrOverdueTasksDocs()
  @UseGuards(JwtAuthGuard)
  @Get('due/today')
  getTodayOrOverdueTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.taskService.findTasksOverdueDate(user.id);
  }

  @MoveTaskDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  @Patch(':taskId/move')
  moveTask(@Param('taskId') taskId: string, @Body() dto: MoveTaskOtherListDto) {
    return this.taskService.moveTaskToList(taskId, dto.newListId, dto.newPosition);
  }
}
