import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { BoardRoleGuard } from '@/auth/guards/board-role.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { BoardRoles } from '@/auth/strategy/decorators/board-rules.decorator';
import { ListService } from '@/list/list.service';

import { CreateListDto } from './dto/create-list.dto';
import {
  CreateListDocs,
  FindAllListsDocs,
  FindOneListDocs,
  UpdateListDocs,
  UpdateListPositionDocs,
  RemoveListDocs,
} from './list.docs';
import { UpdateListDto } from './dto/update-list.dto';

@ApiCookieAuth()
@ApiTags('Lists')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'lists', version: '1' })
export class ListController {
  constructor(private readonly listService: ListService) {}

  @CreateListDocs()
  @Post()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  create(@Body() dto: CreateListDto) {
    return this.listService.create(dto);
  }

  @FindAllListsDocs()
  @Get('board/:boardId')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  findAll(@Param('boardId') boardId: string) {
    return this.listService.findAll(boardId);
  }

  @FindOneListDocs()
  @Get(':listId')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  findOne(@Param('listId') ListlistId: string) {
    return this.listService.findOne(ListlistId);
  }

  @UpdateListDocs()
  @Patch(':listId')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  update(@Param('listId') ListlistId: string, @Body() dto: UpdateListDto) {
    return this.listService.update(ListlistId, dto);
  }

  @UpdateListPositionDocs()
  @Patch(':listId/position')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  updatePosition(@Param('listId') listId: string, @Body() dto: { newPosition: number }) {
    return this.listService.updatePosition(listId, dto.newPosition);
  }

  @RemoveListDocs()
  @Delete(':listId')
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER)
  async remove(@Param('listId') listId: string) {
    await this.listService.remove(listId);
    return { message: 'List removed successfully' };
  }
}
