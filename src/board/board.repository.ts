import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

import { Board, BoardMember, Invite, User, Role } from './types/board.types';

type BoardWithMemberCount = Board & { memberCount: number };
type BoardMemberWithUser = BoardMember & {
  user: {
    id: string;
    name: string;
    userName: string;
    email: string;
    image: string | null;
  };
};

@Injectable()
export class BoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createBoard(data: {
    title: string;
    description?: string;
    ownerId: string;
  }): Promise<Board> {
    const Board = await this.prisma.board.create({ data });
    return Board as Board;
  }

  async findManyBoards(userId: string): Promise<BoardWithMemberCount[]> {
    const boards = await this.prisma.board.findMany({
      where: {
        members: {
          some: {
            userId,
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
    })) as BoardWithMemberCount[];
  }

  async findBoardById(boardId: string): Promise<Board | null> {
    const board = await this.prisma.board.findUnique({ where: { id: boardId } });
    return board as Board | null;
  }

  async findBoardByIdWithMember(boardId: string, userId: string) {
    return this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          where: { userId },
        },
      },
    });
  }

  async updateBoard(
    boardId: string,
    data: { title?: string; description?: string },
  ): Promise<Board> {
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data,
    });
    return board as Board;
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.prisma.board.delete({ where: { id: boardId } });
  }

  async createBoardMember(boardId: string, userId: string, role: Role): Promise<BoardMember> {
    const member = await this.prisma.boardMember.create({
      data: {
        boardId,
        userId,
        role,
      },
    });
    return member as BoardMember;
  }

  async findBoardMember(boardId: string, userId: string): Promise<BoardMember | null> {
    const member = await this.prisma.boardMember.findFirst({
      where: { boardId, userId },
    });
    return member as BoardMember | null;
  }

  async findManyBoardMembers(boardId: string): Promise<BoardMemberWithUser[]> {
    const members = await this.prisma.boardMember.findMany({
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
    return members as BoardMemberWithUser[];
  }

  async deleteBoardMember(boardId: string, userId: string): Promise<void> {
    await this.prisma.boardMember.delete({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });
  }

  async updateBoardMemberRole(boardId: string, userId: string, role: Role): Promise<BoardMember> {
    const member = await this.prisma.boardMember.update({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
      data: { role },
    });
    return member as BoardMember;
  }

  async findNextAdmin(boardId: string, excludeUserId: string): Promise<BoardMember | null> {
    const member = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        role: 'ADMIN',
        userId: { not: excludeUserId },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return member as BoardMember | null;
  }

  async findNextMember(boardId: string, excludeUserId: string): Promise<BoardMember | null> {
    const member = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        role: 'MEMBER',
        userId: { not: excludeUserId },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return member as BoardMember | null;
  }

  async countAdmins(boardId: string): Promise<number> {
    return this.prisma.boardMember.count({
      where: { boardId, role: 'ADMIN' },
    });
  }

  async transferOwnershipAndRemoveMember(
    boardId: string,
    newOwnerId: string,
    memberToRemoveId: string,
    shouldPromoteToAdmin = false,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (shouldPromoteToAdmin) {
        await tx.boardMember.update({
          where: {
            boardId_userId: {
              boardId,
              userId: newOwnerId,
            },
          },
          data: { role: 'ADMIN' },
        });
      }

      await tx.board.update({
        where: { id: boardId },
        data: { ownerId: newOwnerId },
      });

      await tx.boardMember.delete({
        where: {
          boardId_userId: {
            boardId,
            userId: memberToRemoveId,
          },
        },
      });
    });
  }

  async findUserByUsername(userName: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { userName },
    });
    return user as User | null;
  }

  async findInvite(inviteId: string): Promise<Invite | null> {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });
    return invite as Invite | null;
  }

  async findPendingInvite(boardId: string, userId: string): Promise<Invite | null> {
    const invite = await this.prisma.invite.findFirst({
      where: {
        boardId,
        recipientId: userId,
      },
    });
    return invite as Invite | null;
  }

  async createInvite(
    boardId: string,
    senderId: string,
    recipientId: string,
    email: string,
    role: Role,
  ): Promise<Invite> {
    const invite = await this.prisma.invite.create({
      data: {
        boardId,
        senderId,
        recipientId,
        email,
        role,
      },
    });
    return invite as Invite;
  }

  async deleteInvite(inviteId: string): Promise<void> {
    await this.prisma.invite.delete({ where: { id: inviteId } });
  }

  async acceptInviteTransaction(
    boardId: string,
    userId: string,
    role: Role,
    inviteId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.boardMember.create({
        data: {
          boardId,
          userId,
          role,
        },
      });

      await tx.invite.delete({ where: { id: inviteId } });
    });
  }
}
