import { HttpException, Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { AuthProvider, User, Role } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaService } from '@/prisma/prisma.service';

import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createUser(
    data: {
      email: string;
      name: string;
      userName?: string;
      providerId?: string;
      passwordHash?: string;
    },
    provider: AuthProvider,
  ): Promise<User> {
    const { name, email, providerId, passwordHash, userName } = data;
    const userData = {
      email,
      name,
      userName: userName || email.split('@')[0],
      passwordHash: passwordHash || null,
      providerId: provider === AuthProvider.LOCAL ? null : providerId || null,
      role: Role.MEMBER,
      authProvider: provider,
    };

    const user = await this.prisma.user.create({
      data: userData,
    });

    this.eventEmitter.emit('user.created', user);

    return user;
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userData = {
      id: user.id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      authProvider: user.authProvider,
    };

    return userData;
  }

  async updateUser(userId: string, data: UpdateUserDto) {
    if (data.email) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.authProvider !== AuthProvider.LOCAL) {
        throw new HttpException(
          'Cannot update email for users registered via external provider',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    if (!updatedUser) {
      throw new Error('Error updating user');
    }

    return updatedUser;
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          list: {
            board: {
              ownerId: userId,
            },
          },
        },
      });

      await tx.list.deleteMany({
        where: {
          board: {
            ownerId: userId,
          },
        },
      });

      await tx.boardMember.deleteMany({
        where: {
          userId: userId,
        },
      });

      await tx.board.deleteMany({
        where: {
          ownerId: userId,
        },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { message: 'Conta e dados associados excluídos com sucesso' };
  }

  async getNotifications(userId: string) {
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

    return notifications;
  }
}
