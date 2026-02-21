import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

jest.mock('sharp', () => {
  const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('fake-webp'));
  const mockWebp = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
  return jest.fn().mockReturnValue({ webp: mockWebp });
});

import { AuthProvider, Role, User } from '@/common/interfaces';
import { AwsS3Service } from '@/infrastructure/awsS3/awsS3.service';

import { UpdateUserDto } from './dto/update-user.dto';
import { InviteNotification } from './types/user.types';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let repository: DeepMockProxy<UserRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;
  let awsS3Service: DeepMockProxy<AwsS3Service>;
  let configService: DeepMockProxy<ConfigService>;

  const mockUserId = '6217183c-bc01-4bca-8aa0-271b7f9761c5';

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: mockUserId,
    email: 'user@example.com',
    userName: 'testuser',
    name: 'Test User',
    passwordHash: 'hashed_password',
    providerId: null,
    role: Role.MEMBER,
    authProvider: AuthProvider.LOCAL,
    createdAt: new Date(),
    isVerified: false,
    updatedAt: new Date(),
    resetToken: null,
    resetTokenExpiresAt: null,
    image: null,
    ...overrides,
  });

  beforeEach(async () => {
    repository = mockDeep<UserRepository>();
    eventEmitter = mockDeep<EventEmitter2>();
    awsS3Service = mockDeep<AwsS3Service>();
    configService = mockDeep<ConfigService>();

    configService.get.mockImplementation((key: string) => {
      if (key === 'S3_BUCKET_NAME') return 'test-bucket';
      if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserData = {
      email: 'newuser@example.com',
      name: 'New User',
      userName: 'newuser',
      passwordHash: 'hashed',
    };

    it('should create a LOCAL user and emit event', async () => {
      const mockUser = createMockUser({
        email: createUserData.email,
        name: createUserData.name,
        userName: createUserData.userName,
      });
      repository.createUser.mockResolvedValue(mockUser);

      const result = await service.createUser(createUserData, AuthProvider.LOCAL);

      expect(repository.createUser).toHaveBeenCalledWith({
        email: createUserData.email,
        name: createUserData.name,
        userName: createUserData.userName,
        passwordHash: 'hashed',
        providerId: null,
        role: Role.MEMBER,
        authProvider: AuthProvider.LOCAL,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.created', mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should default userName to email prefix when not provided', async () => {
      const dataWithoutUsername = {
        email: 'someone@domain.com',
        name: 'Someone',
      };
      const mockUser = createMockUser({ userName: 'someone' });
      repository.createUser.mockResolvedValue(mockUser);

      await service.createUser(dataWithoutUsername, AuthProvider.LOCAL);

      expect(repository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ userName: 'someone' }),
      );
    });

    it('should set providerId for non-LOCAL providers', async () => {
      const oauthData = {
        email: 'oauth@google.com',
        name: 'OAuth User',
        providerId: 'google-id-123',
      };
      const mockUser = createMockUser();
      repository.createUser.mockResolvedValue(mockUser);

      await service.createUser(oauthData, AuthProvider.GOOGLE);

      expect(repository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'google-id-123',
          authProvider: AuthProvider.GOOGLE,
        }),
      );
    });
  });

  describe('getUser', () => {
    it('should return user data with null image when user has no image', async () => {
      const mockUser = createMockUser();
      repository.findUserById.mockResolvedValue(mockUser);

      const result = await service.getUser(mockUserId);

      expect(repository.findUserById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        userName: mockUser.userName,
        email: mockUser.email,
        authProvider: mockUser.authProvider,
        image: null,
      });
    });

    it('should return full CDN URL when user has an image', async () => {
      const imageKey = 'users/avatars/some-id/123-avatar.webp';
      const mockUser = createMockUser({ image: imageKey });
      repository.findUserById.mockResolvedValue(mockUser);

      const result = await service.getUser(mockUserId);

      expect(result.image).toBe(`https://cdn.example.com/${imageKey}`);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(service.getUser('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      userName: 'updateduser',
      email: 'updated@example.com',
    };

    it('should update user successfully', async () => {
      const mockUser = createMockUser();
      const updatedUser = createMockUser({ name: 'Updated Name' });
      repository.findUserById.mockResolvedValue(mockUser);
      repository.updateUser.mockResolvedValue(updatedUser);

      const result = await service.updateUser(mockUserId, updateDto);

      expect(repository.updateUser).toHaveBeenCalledWith(mockUserId, updateDto);
      expect(result).toEqual(updatedUser);
    });

    it('should throw HttpException when updating email for non-LOCAL provider', async () => {
      const googleUser = createMockUser({ authProvider: AuthProvider.GOOGLE });
      repository.findUserById.mockResolvedValue(googleUser);

      await expect(service.updateUser(mockUserId, updateDto)).rejects.toThrow(
        new HttpException(
          'Cannot update email for users registered via external provider',
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
      );
    });

    it('should skip provider check when email is not being updated', async () => {
      const dtoWithoutEmail: UpdateUserDto = { name: 'New Name' } as UpdateUserDto;
      const updatedUser = createMockUser({ name: 'New Name' });
      repository.updateUser.mockResolvedValue(updatedUser);

      const result = await service.updateUser(mockUserId, dtoWithoutEmail);

      expect(repository.findUserById).not.toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });
  });

  describe('deleteAccount', () => {
    it('should emit user.deleted event and delete account', async () => {
      const mockUser = createMockUser();
      repository.findUserById.mockResolvedValue(mockUser);
      repository.deleteUser.mockResolvedValue(undefined);

      const result = await service.deleteAccount(mockUserId);

      expect(repository.findUserById).toHaveBeenCalledWith(mockUserId);
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.deleted', mockUser);
      expect(repository.deleteUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ message: 'Conta e dados associados excluídos com sucesso' });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(NotFoundException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(repository.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should return user invites', async () => {
      const mockNotifications: InviteNotification[] = [
        {
          id: 'invite-1',
          createdAt: new Date(),
          statusInvite: 'PENDING',
          role: 'MEMBER',
          sender: { id: 'sender-1', name: 'Sender', userName: 'sender' },
          board: { id: 'board-1', title: 'Board 1' },
        },
      ];
      repository.findUserInvites.mockResolvedValue(mockNotifications);

      const result = await service.getNotifications(mockUserId);

      expect(repository.findUserInvites).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('uploadAvatar', () => {
    const buildFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
      size: 1024,
      stream: null as never,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    });

    it('should upload, persist the new key, and NOT delete when no previous image', async () => {
      const mockUser = createMockUser({ image: null });
      repository.findUserById.mockResolvedValue(mockUser);
      awsS3Service.uploadFile.mockResolvedValue(undefined as never);
      repository.updateUserAvatar.mockResolvedValue(undefined);

      const result = await service.uploadAvatar(mockUserId, buildFile());

      expect(awsS3Service.uploadFile).toHaveBeenCalledTimes(1);
      expect(repository.updateUserAvatar).toHaveBeenCalledWith(
        mockUserId,
        expect.stringMatching(/^users\/avatars\/.+\.webp$/),
      );
      expect(awsS3Service.deleteFile).not.toHaveBeenCalled();
      expect(result.imagePath).toMatch(/^https:\/\/cdn\.example\.com\/users\/avatars\/.+\.webp$/);
    });

    it('should delete the old key after uploading a new image', async () => {
      const oldKey = 'users/avatars/old-user/123-avatar.webp';
      const mockUser = createMockUser({ image: oldKey });
      repository.findUserById.mockResolvedValue(mockUser);
      awsS3Service.uploadFile.mockResolvedValue(undefined as never);
      awsS3Service.deleteFile.mockResolvedValue(undefined);
      repository.updateUserAvatar.mockResolvedValue(undefined);

      await service.uploadAvatar(mockUserId, buildFile());

      expect(awsS3Service.deleteFile).toHaveBeenCalledWith('test-bucket', oldKey);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const file = buildFile({ mimetype: 'application/pdf' });

      await expect(service.uploadAvatar(mockUserId, file)).rejects.toThrow(BadRequestException);
      expect(repository.findUserById).not.toHaveBeenCalled();
      expect(awsS3Service.uploadFile).not.toHaveBeenCalled();
    });
  });
});
