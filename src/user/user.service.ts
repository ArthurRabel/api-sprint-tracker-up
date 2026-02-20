import { Readable } from 'stream';

import {
  HttpException,
  Injectable,
  NotFoundException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import sharp from 'sharp';

import { AuthProvider, Role, User } from '@/common/interfaces';
import { AwsS3Service } from '@/infrastructure/awsS3/awsS3.service';

import { UpdateUserDto } from './dto/update-user.dto';
import { InviteNotification } from './types/user.types';
import { UserRepository } from './user.repository';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class UserService {
  private readonly awsbucket: string;
  private readonly baseCdnUrl: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly awsS3Service: AwsS3Service,
    private readonly configService: ConfigService,
  ) {
    this.awsbucket = this.configService.get<string>('S3_BUCKET_NAME') ?? '';
    this.baseCdnUrl = this.configService.get<string>('CDN_BASE_URL') || '';
  }

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

    const imageUrl = user.image ? this.baseCdnUrl + '/' + user.image : null;

    return {
      id: user.id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      authProvider: user.authProvider,
      image: imageUrl,
    };
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

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ imagePath: string }> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only jpeg, png and webp are allowed.');
    }

    const existingUser = await this.userRepository.findUserById(userId);
    const oldKey = existingUser?.image ?? null;

    const webpBuffer = await sharp(file.buffer).webp({ quality: 85 }).toBuffer();

    const key = `users/avatars/${userId}/${Date.now()}-avatar.webp`;

    await this.awsS3Service.uploadFile(
      this.awsbucket,
      key,
      Readable.from(webpBuffer),
      'image/webp',
    );
    await this.userRepository.updateUserAvatar(userId, key);

    if (oldKey) {
      await this.awsS3Service.deleteFile(this.awsbucket, oldKey);
    }

    return { imagePath: this.baseCdnUrl + '/' + key };
  }
}
