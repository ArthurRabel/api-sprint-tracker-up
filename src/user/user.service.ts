import { HttpException, Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AuthProvider, Role, User } from '@/common/interfaces';

import { UpdateUserDto } from './dto/update-user.dto';
import { InviteNotification } from './types/user.types';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
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

    const user = await this.userRepository.createUser(userData);

    this.eventEmitter.emit('user.created', user);

    return user;
  }

  async getUser(userId: string) {
    const user = await this.userRepository.findUserById(userId);

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
      const user = await this.userRepository.findUserById(userId);

      if (user?.authProvider !== AuthProvider.LOCAL) {
        throw new HttpException(
          'Cannot update email for users registered via external provider',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const updatedUser = await this.userRepository.updateUser(userId, data);

    if (!updatedUser) {
      throw new Error('Error updating user');
    }

    return updatedUser;
  }

  async deleteAccount(userId: string) {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.eventEmitter.emit('user.deleted', user);

    await this.userRepository.deleteUser(userId);

    return { message: 'Conta e dados associados excluídos com sucesso' };
  }

  async getNotifications(userId: string): Promise<InviteNotification[]> {
    return this.userRepository.findUserInvites(userId);
  }
}
