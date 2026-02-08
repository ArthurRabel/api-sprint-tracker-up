import { BoardVisibility, Role, statusInvite } from '@prisma/client';

import { getPrismaClient } from './database.helper';

export interface TestBoard {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  visibility: BoardVisibility;
  isArchived: boolean;
}

export interface TestBoardMember {
  boardId: string;
  userId: string;
  role: Role;
}

export interface TestInvite {
  id: string;
  boardId: string;
  senderId: string;
  recipientId: string;
  email: string;
  statusInvite: statusInvite;
  role: Role;
}

export async function createTestBoard(
  ownerId: string,
  overrides?: Partial<TestBoard>,
): Promise<TestBoard> {
  const prisma = getPrismaClient();
  const timestamp = Date.now();

  const defaultBoard = {
    title: `Test Board ${timestamp}`,
    description: 'Test board description',
    visibility: BoardVisibility.PRIVATE,
    isArchived: false,
    ownerId,
    ...overrides,
  };

  const board = await prisma.board.create({
    data: defaultBoard,
  });

  // Automatically add owner as ADMIN member
  await prisma.boardMember.create({
    data: {
      boardId: board.id,
      userId: ownerId,
      role: Role.ADMIN,
    },
  });

  return board as TestBoard;
}

export async function addMemberToBoard(
  boardId: string,
  userId: string,
  role: Role = Role.MEMBER,
): Promise<TestBoardMember> {
  const prisma = getPrismaClient();

  const member = await prisma.boardMember.create({
    data: {
      boardId,
      userId,
      role,
    },
  });

  return member as TestBoardMember;
}

export async function createTestInvite(
  boardId: string,
  senderId: string,
  recipientId: string,
  recipientEmail: string,
  overrides?: Partial<TestInvite>,
): Promise<TestInvite> {
  const prisma = getPrismaClient();

  const defaultInvite = {
    boardId,
    senderId,
    recipientId,
    email: recipientEmail,
    statusInvite: statusInvite.PENDING,
    role: Role.MEMBER,
    ...overrides,
  };

  const invite = await prisma.invite.create({
    data: defaultInvite,
  });

  return invite as TestInvite;
}

export async function removeMemberFromBoard(boardId: string, userId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.boardMember.delete({
    where: {
      boardId_userId: {
        boardId,
        userId,
      },
    },
  });
}
