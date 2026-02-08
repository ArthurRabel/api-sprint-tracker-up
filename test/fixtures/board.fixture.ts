import { BoardVisibility, Role } from '@prisma/client';

export function mockCreateBoardDto(overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    title: `Test Board ${timestamp}`,
    description: 'Test board description',
    visibility: BoardVisibility.PRIVATE,
    ...overrides,
  };
}

export function mockUpdateBoardDto(overrides?: Record<string, unknown>) {
  return {
    title: 'Updated Board Title',
    description: 'Updated description',
    ...overrides,
  };
}

export function mockInviteBoardDto(userName: string, role: Role = Role.MEMBER) {
  return {
    userName,
    role,
  };
}

export function mockResponseInviteBoardDto(idInvite: string, response: boolean) {
  return {
    idInvite,
    response,
  };
}

export function mockUpdateMemberRoleDto(role: Role) {
  return {
    role,
  };
}

export function mockBoardData(overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    title: `Board ${timestamp}`,
    description: 'Board description',
    visibility: BoardVisibility.PRIVATE,
    isArchived: false,
    ...overrides,
  };
}
