import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { BoardService } from '@/board/board.service';
import { AuthProvider, Role, User } from '@/common/interfaces';

import { UpdateUserDto } from './dto/update-user.dto';
import { InviteNotification } from './types/user.types';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let repository: DeepMockProxy<UserRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;
  let boardService: DeepMockProxy<BoardService>;

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
    CreatedAt: new Date(),
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
    boardService = mockDeep<BoardService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: BoardService, useValue: boardService },
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
    it('should return user data when user exists', async () => {
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
      });
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
    it('should remove user from all boards and delete account', async () => {
      const mockUser = createMockUser();
      const memberships = [{ boardId: 'board-1' }, { boardId: 'board-2' }];
      repository.findUserById.mockResolvedValue(mockUser);
      repository.findUserBoardMemberships.mockResolvedValue(memberships);
      boardService.removeMember.mockResolvedValue({ message: 'Member removed successfully' });
      repository.deleteUser.mockResolvedValue(undefined);

      const result = await service.deleteAccount(mockUserId);

      expect(repository.findUserById).toHaveBeenCalledWith(mockUserId);
      expect(repository.findUserBoardMemberships).toHaveBeenCalledWith(mockUserId);
      expect(boardService.removeMember).toHaveBeenCalledTimes(2);
      expect(boardService.removeMember).toHaveBeenCalledWith('board-1', mockUserId, mockUserId);
      expect(boardService.removeMember).toHaveBeenCalledWith('board-2', mockUserId, mockUserId);
      expect(repository.deleteUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ message: 'Conta e dados associados excluídos com sucesso' });
    });

    it('should delete account when user has no board memberships', async () => {
      const mockUser = createMockUser();
      repository.findUserById.mockResolvedValue(mockUser);
      repository.findUserBoardMemberships.mockResolvedValue([]);
      repository.deleteUser.mockResolvedValue(undefined);

      const result = await service.deleteAccount(mockUserId);

      expect(boardService.removeMember).not.toHaveBeenCalled();
      expect(repository.deleteUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ message: 'Conta e dados associados excluídos com sucesso' });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repository.findUserBoardMemberships).not.toHaveBeenCalled();
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
});
