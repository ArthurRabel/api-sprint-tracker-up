import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { BoardRoleGuard } from '@/auth/guards/board-role.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { BoardRoles } from '@/auth/strategy/decorators/board-rules.decorator';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';

import {
  CreateBoardDocs,
  FindAllBoardsDocs,
  FindOneBoardDocs,
  UpdateBoardDocs,
  RemoveBoardDocs,
  ListMembersDocs,
  RemoveMemberDocs,
  ChangeMemberRoleDocs,
  InviteBoardDocs,
  ResponseInviteBoardDocs,
} from './board.docs';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { InviteBoardDto } from './dto/invite-to-board.dto';
import { ResponseInviteBoardDto } from './dto/response-invite.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiCookieAuth()
@ApiTags('Boards')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'boards', version: '1' })
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @CreateBoardDocs()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBoardDto) {
    return this.boardService.create(user.id, dto);
  }

  @FindAllBoardsDocs()
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.boardService.findAll(user.id);
  }

  @FindOneBoardDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  @Get(':boardId')
  findOne(@Param('boardId') boardId: string) {
    return this.boardService.findOne(boardId);
  }

  @UpdateBoardDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN)
  @Patch(':boardId')
  update(@Param('boardId') boardId: string, @Body() dto: UpdateBoardDto) {
    return this.boardService.update(boardId, dto);
  }

  @RemoveBoardDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN)
  @Delete(':boardId')
  remove(@Param('boardId') boardId: string) {
    return this.boardService.remove(boardId);
  }

  @ListMembersDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  @Get(':boardId/members')
  listMembers(@Param('boardId') boardId: string) {
    return this.boardService.listMembers(boardId);
  }

  @RemoveMemberDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN)
  @Delete(':boardId/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
  ) {
    return this.boardService.removeMember(boardId, userId, user.id);
  }

  @ChangeMemberRoleDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN)
  @Patch(':boardId/members/:userId/role')
  changeMemberRole(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.boardService.changeMemberRole(boardId, userId, requester.id, dto);
  }

  @InviteBoardDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN)
  @Post('invite/:boardId')
  invite(
    @CurrentUser() sender: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @Body() dto: InviteBoardDto,
  ) {
    return this.boardService.invite(boardId, sender.id, dto);
  }

  @ResponseInviteBoardDocs()
  @UseGuards(JwtAuthGuard)
  @Post('invite/:boardId/response')
  responseInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @Body() dto: ResponseInviteBoardDto,
  ) {
    return this.boardService.responseInvite(boardId, user.id, dto);
  }
}
