import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { BoardGateway } from '@/events/board.gateway';
import { NotificationsGateway } from '@/events/notification.gateway';

import { BOARD_ACTIONS, ERROR_MESSAGES, SUCCESS_MESSAGES } from './board.constants';
import { BoardRepository } from './board.repository';
import { CreateBoardDto } from './dto/create-board.dto';
import { InviteBoardDto } from './dto/invite-to-board.dto';
import { ResponseInviteBoardDto } from './dto/response-invite.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Board, BoardMember, Invite, Role } from './types/board.types';

@Injectable()
export class BoardService {
  constructor(
    private readonly repository: BoardRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly boardGateway: BoardGateway,
  ) {}

  async create(ownerId: string, dto: CreateBoardDto) {
    const board = await this.repository.createBoard({
      ...dto,
      ownerId,
    });

    await this.repository.createBoardMember(board.id, ownerId, Role.ADMIN);

    return board;
  }

  async findAll(idUser: string) {
    return this.repository.findManyBoards(idUser);
  }

  async findOne(id: string): Promise<Board> {
    const board = await this.repository.findBoardById(id);
    if (!board) {
      throw new NotFoundException(ERROR_MESSAGES.BOARD_NOT_FOUND);
    }
    return board;
  }

  async getBoardById(boardId: string, userId: string) {
    const board = await this.repository.findBoardByIdWithMember(boardId, userId);

    if (!board) {
      throw new NotFoundException(ERROR_MESSAGES.BOARD_NOT_FOUND);
    }
    if (board.members.length === 0) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_ACCESS);
    }

    return board;
  }

  async update(boardId: string, dto: UpdateBoardDto) {
    await this.findOne(boardId);
    const updated = await this.repository.updateBoard(boardId, dto);

    this.emitBoardEvent(boardId, BOARD_ACTIONS.UPDATED, {});

    return updated;
  }

  async remove(boardId: string) {
    await this.findOne(boardId);
    await this.repository.deleteBoard(boardId);
    return { message: SUCCESS_MESSAGES.BOARD_DELETED };
  }

  async listMembers(boardId: string) {
    await this.findOne(boardId);
    return this.repository.findManyBoardMembers(boardId);
  }

  async removeMember(boardId: string, memberUserId: string, requesterId: string) {
    const board = await this.findOne(boardId);

    if (memberUserId === board.ownerId) {
      return this.handleOwnerRemoval(boardId, memberUserId, requesterId);
    }

    return this.handleRegularMemberRemoval(boardId, memberUserId, requesterId);
  }

  async changeMemberRole(
    boardId: string,
    targetUserId: string,
    requesterId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const board = await this.findOne(boardId);

    if (targetUserId === board.ownerId) {
      throw new ForbiddenException(ERROR_MESSAGES.CANNOT_CHANGE_OWNER_ROLE);
    }

    const targetMembership = await this.getMemberOrFail(boardId, targetUserId);

    await this.validateAdminDemotion(boardId, targetMembership.role, dto.role);

    const updated = await this.repository.updateBoardMemberRole(boardId, targetUserId, dto.role);

    this.emitBoardEvent(boardId, BOARD_ACTIONS.MEMBER_ROLE_CHANGED, {
      memberUserId: targetUserId,
      newRole: dto.role,
      by: requesterId,
    });

    return updated;
  }

  async invite(boardId: string, senderId: string, dto: InviteBoardDto) {
    await this.findOne(boardId);

    const recipient = await this.getUserByUsernameOrFail(dto.userName);

    await this.validateInviteEligibility(boardId, recipient.id);

    await this.repository.createInvite(boardId, senderId, recipient.id, recipient.email, dto.role);

    this.notificationsGateway.sendNewNotificationToUser(recipient.id);

    return { message: SUCCESS_MESSAGES.INVITE_SENT };
  }

  async responseInvite(boardId: string, recipientId: string, dto: ResponseInviteBoardDto) {
    const invite = await this.getInviteOrFail(dto.idInvite);

    this.validateInviteRecipient(invite, recipientId);

    if (!dto.response) {
      await this.repository.deleteInvite(dto.idInvite);
      return { message: SUCCESS_MESSAGES.INVITE_DECLINED };
    }

    await this.acceptInvite(boardId, recipientId, invite, dto.idInvite);

    return { message: SUCCESS_MESSAGES.INVITE_ACCEPTED };
  }

  private async getMemberOrFail(boardId: string, userId: string): Promise<BoardMember> {
    const member = await this.repository.findBoardMember(boardId, userId);
    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.MEMBER_NOT_FOUND);
    }
    return member;
  }

  private async transferOwnershipAndRemove(
    boardId: string,
    newOwnerId: string,
    memberToRemoveId: string,
    shouldPromoteToAdmin = false,
  ) {
    await this.repository.transferOwnershipAndRemoveMember(
      boardId,
      newOwnerId,
      memberToRemoveId,
      shouldPromoteToAdmin,
    );
  }

  private async handleOwnerRemoval(boardId: string, ownerId: string, requesterId: string) {
    if (requesterId !== ownerId) {
      throw new ForbiddenException(ERROR_MESSAGES.CANNOT_REMOVE_OWNER);
    }

    const nextAdmin = await this.repository.findNextAdmin(boardId, requesterId);

    if (nextAdmin) {
      await this.transferOwnershipAndRemove(boardId, nextAdmin.userId, ownerId);
      this.emitMemberRemovedEvent(boardId, ownerId, requesterId);
      return { message: SUCCESS_MESSAGES.OWNERSHIP_TRANSFERRED_ADMIN };
    }

    const nextMember = await this.repository.findNextMember(boardId, requesterId);

    if (nextMember) {
      await this.transferOwnershipAndRemove(boardId, nextMember.userId, ownerId, true);
      this.emitMemberRemovedEvent(boardId, ownerId, requesterId);
      return { message: SUCCESS_MESSAGES.OWNERSHIP_TRANSFERRED_MEMBER };
    }

    await this.repository.deleteBoard(boardId);
    return { message: SUCCESS_MESSAGES.BOARD_DELETED_ONLY_OWNER };
  }

  private async handleRegularMemberRemoval(
    boardId: string,
    memberUserId: string,
    requesterId: string,
  ) {
    await this.getMemberOrFail(boardId, memberUserId);

    if (requesterId !== memberUserId) {
      await this.validateAdminPermission(boardId, requesterId);
    }

    await this.repository.deleteBoardMember(boardId, memberUserId);

    this.emitMemberRemovedEvent(boardId, memberUserId, requesterId);

    return { message: SUCCESS_MESSAGES.MEMBER_REMOVED };
  }

  private async validateAdminPermission(boardId: string, userId: string) {
    const membership = await this.repository.findBoardMember(boardId, userId);

    if (membership?.role !== Role.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.ONLY_ADMINS_CAN_REMOVE);
    }
  }

  private async validateAdminDemotion(boardId: string, currentRole: Role, newRole: Role) {
    if (currentRole === Role.ADMIN && newRole !== Role.ADMIN) {
      const adminCount = await this.repository.countAdmins(boardId);

      if (adminCount <= 1) {
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_DEMOTE_ONLY_ADMIN);
      }
    }
  }

  private async getUserByUsernameOrFail(userName: string) {
    const user = await this.repository.findUserByUsername(userName);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.RECIPIENT_NOT_FOUND);
    }

    return user;
  }

  private async validateInviteEligibility(boardId: string, userId: string) {
    const existingInvite = await this.repository.findPendingInvite(boardId, userId);

    if (existingInvite) {
      throw new BadRequestException(ERROR_MESSAGES.PENDING_INVITE_EXISTS);
    }

    const isMember = await this.repository.findBoardMember(boardId, userId);

    if (isMember) {
      throw new BadRequestException(ERROR_MESSAGES.ALREADY_MEMBER);
    }
  }

  private async getInviteOrFail(inviteId: string): Promise<Invite> {
    const invite = await this.repository.findInvite(inviteId);

    if (!invite) {
      throw new NotFoundException(ERROR_MESSAGES.INVITE_NOT_FOUND);
    }

    return invite;
  }

  private validateInviteRecipient(invite: Invite, recipientId: string) {
    if (invite.recipientId !== recipientId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_FOR_INVITE);
    }
  }

  private async acceptInvite(
    boardId: string,
    recipientId: string,
    invite: Invite,
    inviteId: string,
  ) {
    await this.repository.acceptInviteTransaction(boardId, recipientId, invite.role, inviteId);
  }

  private emitBoardEvent(
    boardId: string,
    action: string,
    additionalData: Record<string, string | number | boolean> = {},
  ) {
    const payload = {
      boardId,
      action,
      ...additionalData,
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(boardId, payload);
  }

  private emitMemberRemovedEvent(boardId: string, memberUserId: string, by: string) {
    this.emitBoardEvent(boardId, BOARD_ACTIONS.MEMBER_REMOVED, {
      memberUserId,
      by,
    });
  }
}
