import { Injectable } from '@nestjs/common';

import { AuthProvider, Role, User } from '@/common/interfaces';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { UpdateUserDto } from './dto/update-user.dto';
import { InviteNotification } from './types/user.types';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: {
    email: string;
    name: string;
    userName: string;
    providerId: string | null;
    passwordHash: string | null;
    role: Role;
    authProvider: AuthProvider;
  }): Promise<User> {
    const user = await this.prisma.user.create({ data });
    return user as User;
  }

  async findUserById(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user as User | null;
  }

  async updateUser(userId: string, data: UpdateUserDto): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return user as User;
  }

  async findUserBoardMemberships(userId: string): Promise<{ boardId: string }[]> {
    return this.prisma.boardMember.findMany({
      where: { userId },
      select: { boardId: true },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async findUserInvites(userId: string): Promise<InviteNotification[]> {
    const notifications = await this.prisma.invite.findMany({
      where: { recipientId: userId },
      select: {
        id: true,
        createdAt: true,
        statusInvite: true,
        role: true,
        sender: {
          select: {
            id: true,
            name: true,
            userName: true,
          },
        },
        board: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notifications as InviteNotification[];
  }
}
