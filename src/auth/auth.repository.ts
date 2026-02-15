import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { User } from './types/auth.types';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user as User | null;
  }

  async findUserById(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user as User | null;
  }

  async findUserByUsername(userName: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { userName },
    });
    return user as User | null;
  }

  async findUserByResetToken(resetToken: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { resetToken },
    });
    return user as User | null;
  }

  async updateUserResetToken(email: string, resetToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiresAt: expiresAt,
      },
    });
  }

  async clearUserResetToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
