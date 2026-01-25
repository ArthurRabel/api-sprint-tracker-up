import { Injectable, NotFoundException } from '@nestjs/common';

import { BoardGateway } from '@/events/board.gateway';
import { NotificationsGateway } from '@/events/notification.gateway';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateBoardDto } from './dto/create-board.dto';
import { InviteBoardDto } from './dto/invite-to-board.dto';
import { ResponseInviteBoardDto } from './dto/response-invite.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly boardGateway: BoardGateway,
  ) {}

  async create(ownerId: string, dto: CreateBoardDto) {
    const board = await this.prisma.board.create({
      data: {
        ...dto,
        ownerId,
      },
    });

    await this.prisma.boardMember.create({
      data: {
        boardId: board.id,
        userId: ownerId,
        role: 'ADMIN',
      },
    });

    return board;
  }

  async findAll(idUser: string) {
    const boards = await this.prisma.board.findMany({
      where: {
        members: {
          some: {
            userId: idUser,
          },
        },
        isArchived: false,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return boards.map(({ _count, ...board }) => ({
      ...board,
      memberCount: _count?.members ?? 0,
    }));
  }

  async findOne(id: string) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async getBoardById(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!board) throw new NotFoundException('Board not found');
    if (board.members.length === 0) {
      throw new NotFoundException('You do not have access to this board');
    }

    return board;
  }

  async update(boardId: string, dto: UpdateBoardDto) {
    await this.findOne(boardId);
    const updated = await this.prisma.board.update({
      where: { id: boardId },
      data: { ...dto },
    });
    const payload = {
      boardId,
      action: 'updated',
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(boardId, payload);
    return updated;
  }

  async remove(boardId: string) {
    await this.findOne(boardId);
    await this.prisma.board.delete({ where: { id: boardId } });
    return { message: 'Board deleted successfully' };
  }

  async listMembers(boardId: string) {
    await this.findOne(boardId);
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            userName: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async removeMember(boardId: string, memberUserId: string, requesterId: string) {
    const board = await this.findOne(boardId);

    // If the target is the board owner
    if (memberUserId === board.ownerId) {
      // Only the owner can remove themselves
      if (requesterId !== memberUserId) {
        throw new NotFoundException('Cannot remove the board owner');
      }

      // Try to transfer to the oldest ADMIN (except current owner)
      const nextAdmin = await this.prisma.boardMember.findFirst({
        where: {
          boardId,
          role: 'ADMIN',
          userId: { not: requesterId },
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (!nextAdmin) {
        // No other ADMIN. Try to promote the oldest MEMBER (observers cannot be promoted)
        const nextMember = await this.prisma.boardMember.findFirst({
          where: {
            boardId,
            role: 'MEMBER',
            userId: { not: requesterId },
          },
          orderBy: { joinedAt: 'asc' },
        });

        if (!nextMember) {
          // No ADMIN or MEMBER (only observers or none): delete board and relationships
          await this.prisma.board.delete({ where: { id: boardId } });

          return {
            message: 'Board deleted, you were the only eligible member (no ADMIN/MEMBER)',
          };
        }

        // Promote the oldest MEMBER to ADMIN and transfer ownership
        await this.prisma.$transaction(async (tx) => {
          await tx.boardMember.update({
            where: {
              boardId_userId: {
                boardId,
                userId: nextMember.userId,
              },
            },
            data: { role: 'ADMIN' },
          });

          await tx.board.update({
            where: { id: boardId },
            data: { ownerId: nextMember.userId },
          });

          await tx.boardMember.delete({
            where: {
              boardId_userId: {
                boardId,
                userId: memberUserId,
              },
            },
          });
        });

        const payload = {
          boardId,
          action: 'member_removed',
          memberUserId,
          by: requesterId,
          at: new Date().toISOString(),
        };
        this.boardGateway.emitModifiedInBoard(boardId, payload);

        return {
          message:
            'Ownership transferred to the oldest member (promoted to ADMIN) and user removed',
        };
      }

      // There is another ADMIN: transfer ownership and remove current owner
      await this.prisma.$transaction(async (tx) => {
        await tx.board.update({
          where: { id: boardId },
          data: { ownerId: nextAdmin.userId },
        });

        await tx.boardMember.delete({
          where: {
            boardId_userId: {
              boardId,
              userId: memberUserId,
            },
          },
        });
      });

      const payload = {
        boardId,
        action: 'member_removed',
        memberUserId,
        by: requesterId,
        at: new Date().toISOString(),
      };
      this.boardGateway.emitModifiedInBoard(boardId, payload);

      return {
        message: 'Ownership transferred to the oldest ADMIN and member removed',
      };
    }

    // Target is not the owner: get the target's membership
    const targetMembership = await this.prisma.boardMember.findFirst({
      where: { boardId, userId: memberUserId },
    });
    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this board');
    }

    // If removing another person, must be ADMIN
    if (requesterId !== memberUserId) {
      const requesterMembership = await this.prisma.boardMember.findFirst({
        where: { boardId, userId: requesterId },
      });

      if (requesterMembership?.role !== 'ADMIN') {
        throw new NotFoundException('Only administrators can remove other members');
      }
    }

    // Self-removal of OBSERVER/MEMBER (and also non-owner ADMIN, allowed)
    await this.prisma.boardMember.delete({
      where: {
        boardId_userId: {
          boardId,
          userId: memberUserId,
        },
      },
    });

    const payload = {
      boardId,
      action: 'member_removed',
      memberUserId,
      by: requesterId,
      at: new Date().toISOString(),
    };
    this.boardGateway.emitModifiedInBoard(boardId, payload);

    return { message: 'Member removed successfully' };
  }

  async changeMemberRole(
    boardId: string,
    targetUserId: string,
    requesterId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const board = await this.findOne(boardId);

    if (targetUserId === board.ownerId) {
      throw new NotFoundException('Cannot change the board owner role');
    }

    const targetMembership = await this.prisma.boardMember.findFirst({
      where: { boardId, userId: targetUserId },
    });
    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this board');
    }

    if (targetMembership.role === 'ADMIN' && dto.role !== 'ADMIN') {
      const adminCount = await this.prisma.boardMember.count({
        where: { boardId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new NotFoundException('Cannot demote the only ADMIN of the board');
      }
    }

    const updated = await this.prisma.boardMember.update({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUserId,
        },
      },
      data: { role: dto.role },
    });

    const payload = {
      boardId,
      action: 'member_role_changed',
      memberUserId: targetUserId,
      newRole: dto.role,
      by: requesterId,
      at: new Date().toISOString(),
    } as const;
    this.boardGateway.emitModifiedInBoard(boardId, payload);

    return { message: 'Role changed successfully', member: updated };
  }

  async invite(boardId: string, senderId: string, dto: InviteBoardDto) {
    await this.findOne(boardId);

    const memberRole = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId: senderId,
      },
    });

    if (memberRole?.role !== 'ADMIN') {
      throw new NotFoundException('You do not have permission to invite users to this board');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        boardId,
        recipientId: recipient.id,
      },
    });

    if (existingInvite) {
      throw new NotFoundException('There is already a pending invite for this user');
    }

    const isMember = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId: recipient.id,
      },
    });

    if (isMember) {
      throw new NotFoundException('This user is already a member of the board');
    }

    await this.prisma.invite.create({
      data: {
        boardId,
        senderId: senderId,
        recipientId: recipient.id,
        email: recipient.email,
        role: dto.role,
      },
    });

    this.notificationsGateway.sendNewNotificationToUser(recipient.id);

    return { message: 'Invite sent successfully' };
  }

  async responseInvite(boardId: string, recipientId: string, dto: ResponseInviteBoardDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { id: dto.idInvite },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.recipientId !== recipientId) {
      throw new NotFoundException('You do not have permission to accept this invite');
    }

    if (!dto.response) {
      await this.prisma.invite.delete({ where: { id: dto.idInvite } });
      return { message: 'Invite declined successfully' };
    }

    await this.prisma.$transaction(async (prisma) => {
      await prisma.boardMember.create({
        data: {
          boardId,
          userId: recipientId,
          role: invite.role,
        },
      });

      await prisma.invite.delete({ where: { id: dto.idInvite } });
    });

    return { message: 'Invite accepted successfully' };
  }
}
