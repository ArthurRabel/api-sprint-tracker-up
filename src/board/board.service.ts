import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly eventEmitter: EventEmitter2,
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
      throw new NotFoundException('Board not found');
    }
    return board;
  }

  async getBoardById(boardId: string, userId: string) {
    const board = await this.repository.findBoardByIdWithMember(boardId, userId);

    if (!board) {
      throw new NotFoundException('Board not found');
    }
    if (board.members.length === 0) {
      throw new ForbiddenException('You do not have access to this board');
    }

    return board;
  }

  async update(boardId: string, dto: UpdateBoardDto) {
    await this.findOne(boardId);
    const updated = await this.repository.updateBoard(boardId, dto);

    this.emitBoardEvent(boardId, 'updated', {});

    return updated;
  }

  async remove(boardId: string) {
    await this.findOne(boardId);
    await this.repository.deleteBoard(boardId);
    return { message: 'Board deleted successfully' };
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
      throw new ForbiddenException('Cannot change the board owner role');
    }

    const targetMembership = await this.getMemberOrFail(boardId, targetUserId);

    await this.validateAdminDemotion(boardId, targetMembership.role, dto.role);

    const updated = await this.repository.updateBoardMemberRole(boardId, targetUserId, dto.role);

    this.emitBoardEvent(boardId, 'member_role_changed', {
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

    this.eventEmitter.emit('notification.new', { userId: recipient.id });

    return { message: 'Invite sent successfully' };
  }

  async responseInvite(boardId: string, recipientId: string, dto: ResponseInviteBoardDto) {
    const invite = await this.getInviteOrFail(dto.idInvite);

    this.validateInviteRecipient(invite, recipientId);

    if (!dto.response) {
      await this.repository.deleteInvite(dto.idInvite);
      return { message: 'Invite declined successfully' };
    }

    await this.acceptInvite(boardId, recipientId, invite, dto.idInvite);

    return { message: 'Invite accepted successfully' };
  }

  private async getMemberOrFail(boardId: string, userId: string): Promise<BoardMember> {
    const member = await this.repository.findBoardMember(boardId, userId);
    if (!member) {
      throw new NotFoundException('User is not a member of this board');
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
      throw new ForbiddenException('Cannot remove the board owner');
    }

    const nextAdmin = await this.repository.findNextAdmin(boardId, requesterId);

    if (nextAdmin) {
      await this.transferOwnershipAndRemove(boardId, nextAdmin.userId, ownerId);
      this.emitMemberRemovedEvent(boardId, ownerId, requesterId);
      return { message: 'Ownership transferred to the oldest ADMIN and member removed' };
    }

    const nextMember = await this.repository.findNextMember(boardId, requesterId);

    if (nextMember) {
      await this.transferOwnershipAndRemove(boardId, nextMember.userId, ownerId, true);
      this.emitMemberRemovedEvent(boardId, ownerId, requesterId);
      return {
        message: 'Ownership transferred to the oldest member (promoted to ADMIN) and user removed',
      };
    }

    await this.repository.deleteBoard(boardId);
    return { message: 'Board deleted, you were the only eligible member (no ADMIN/MEMBER)' };
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

    return { message: 'Member removed successfully' };
  }

  private async validateAdminPermission(boardId: string, userId: string) {
    const membership = await this.repository.findBoardMember(boardId, userId);

    if (membership?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can remove other members');
    }
  }

  private async validateAdminDemotion(boardId: string, currentRole: Role, newRole: Role) {
    if (currentRole === Role.ADMIN && newRole !== Role.ADMIN) {
      const adminCount = await this.repository.countAdmins(boardId);

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the only ADMIN of the board');
      }
    }
  }

  private async getUserByUsernameOrFail(userName: string) {
    const user = await this.repository.findUserByUsername(userName);

    if (!user) {
      throw new NotFoundException('Recipient not found');
    }

    return user;
  }

  private async validateInviteEligibility(boardId: string, userId: string) {
    const existingInvite = await this.repository.findPendingInvite(boardId, userId);

    if (existingInvite) {
      throw new BadRequestException('There is already a pending invite for this user');
    }

    const isMember = await this.repository.findBoardMember(boardId, userId);

    if (isMember) {
      throw new BadRequestException('This user is already a member of the board');
    }
  }

  private async getInviteOrFail(inviteId: string): Promise<Invite> {
    const invite = await this.repository.findInvite(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    return invite;
  }

  private validateInviteRecipient(invite: Invite, recipientId: string) {
    if (invite.recipientId !== recipientId) {
      throw new ForbiddenException('You do not have permission to accept this invite');
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
    this.eventEmitter.emit('board.modified', payload);
  }

  private emitMemberRemovedEvent(boardId: string, memberUserId: string, by: string) {
    this.emitBoardEvent(boardId, 'member_removed', {
      memberUserId,
      by,
    });
  }
}
