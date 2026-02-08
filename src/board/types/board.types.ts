export enum Role {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  OBSERVER = 'OBSERVER',
}

export enum BoardVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  TEAM = 'TEAM',
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  visibility: BoardVisibility;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardMember {
  boardId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}

export interface Invite {
  id: string;
  boardId: string;
  senderId: string;
  recipientId: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface User {
  id: string;
  name: string;
  userName: string;
  email: string;
  image: string | null;
}

export interface BoardWithMemberCount extends Board {
  memberCount: number;
}

export interface BoardMemberWithUser extends BoardMember {
  user: {
    id: string;
    name: string;
    userName: string;
    email: string;
    image: string | null;
  };
}
