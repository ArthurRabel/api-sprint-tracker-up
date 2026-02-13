import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { BoardRepository } from './board.repository';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { InviteBoardDto } from './dto/invite-to-board.dto';
import { ResponseInviteBoardDto } from './dto/response-invite.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Board, BoardMember, Invite, Role, User } from './types/board.types';

describe('BoardService', () => {
  let service: BoardService;
  let repository: DeepMockProxy<BoardRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  const mockUserId = '6217183c-bc01-4bca-8aa0-271b7f9761c5';
  const mockBoardId = 'board-123';
  const mockInviteId = 'invite-123';
  const mockRecipientId = 'recipient-456';

  const createMockBoard = (overrides = {}): Board => ({
    id: mockBoardId,
    title: 'Test Board',
    description: 'Test Description',
    ownerId: mockUserId,
    visibility: 'PRIVATE' as any,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockBoardMember = (overrides = {}): BoardMember => ({
    boardId: mockBoardId,
    userId: mockUserId,
    role: Role.ADMIN,
    joinedAt: new Date(),
    ...overrides,
  });

  const createMockUser = (overrides = {}): User => ({
    id: mockRecipientId,
    name: 'Test User',
    userName: 'testuser',
    email: 'test@example.com',
    image: null,
    ...overrides,
  });

  const createMockInvite = (overrides = {}): Invite => ({
    id: mockInviteId,
    boardId: mockBoardId,
    senderId: mockUserId,
    recipientId: mockRecipientId,
    email: 'test@example.com',
    role: Role.MEMBER,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    repository = mockDeep<BoardRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: BoardRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<BoardService>(BoardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a board and add owner as admin member', async () => {
      const dto: CreateBoardDto = {
        title: 'New Board',
        description: 'New Description',
      };
      const mockBoard = createMockBoard({ title: dto.title });

      repository.createBoard.mockResolvedValue(mockBoard);
      repository.createBoardMember.mockResolvedValue({} as BoardMember);

      const result = await service.create(mockUserId, dto);

      expect(repository.createBoard).toHaveBeenCalledWith({
        ...dto,
        ownerId: mockUserId,
      });
      expect(repository.createBoardMember).toHaveBeenCalledWith(
        mockBoard.id,
        mockUserId,
        Role.ADMIN,
      );
      expect(result).toEqual(mockBoard);
    });
  });

  describe('findAll', () => {
    it('should return all boards for a user', async () => {
      const mockBoards = [createMockBoard(), createMockBoard({ id: 'board-456' })];
      repository.findManyBoards.mockResolvedValue(mockBoards as any);

      const result = await service.findAll(mockUserId);

      expect(repository.findManyBoards).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockBoards);
    });
  });

  describe('findOne', () => {
    it('should return a board by id', async () => {
      const mockBoard = createMockBoard();
      repository.findBoardById.mockResolvedValue(mockBoard);

      const result = await service.findOne(mockBoardId);

      expect(repository.findBoardById).toHaveBeenCalledWith(mockBoardId);
      expect(result).toEqual(mockBoard);
    });

    it('should throw NotFoundException if board not found', async () => {
      repository.findBoardById.mockResolvedValue(null);

      await expect(service.findOne(mockBoardId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(mockBoardId)).rejects.toThrow('Board not found');
    });
  });

  describe('getBoardById', () => {
    it('should return board if user is a member', async () => {
      const mockBoard = {
        ...createMockBoard(),
        members: [createMockBoardMember()],
      };
      repository.findBoardByIdWithMember.mockResolvedValue(mockBoard as any);

      const result = await service.getBoardById(mockBoardId, mockUserId);

      expect(repository.findBoardByIdWithMember).toHaveBeenCalledWith(mockBoardId, mockUserId);
      expect(result).toEqual(mockBoard);
    });

    it('should throw NotFoundException if board not found', async () => {
      repository.findBoardByIdWithMember.mockResolvedValue(null);

      await expect(service.getBoardById(mockBoardId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBoardById(mockBoardId, mockUserId)).rejects.toThrow(
        'Board not found',
      );
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      const mockBoard = {
        ...createMockBoard(),
        members: [],
      };
      repository.findBoardByIdWithMember.mockResolvedValue(mockBoard as any);

      await expect(service.getBoardById(mockBoardId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getBoardById(mockBoardId, mockUserId)).rejects.toThrow(
        'You do not have access to this board',
      );
    });
  });

  describe('update', () => {
    it('should update a board and emit event', async () => {
      const dto: UpdateBoardDto = { title: 'Updated Title' };
      const mockBoard = createMockBoard();
      const updatedBoard = createMockBoard({ title: 'Updated Title' });

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.updateBoard.mockResolvedValue(updatedBoard);

      const result = await service.update(mockBoardId, dto);

      expect(repository.findBoardById).toHaveBeenCalledWith(mockBoardId);
      expect(repository.updateBoard).toHaveBeenCalledWith(mockBoardId, dto);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.modified',
        expect.objectContaining({
          boardId: mockBoardId,
          action: 'updated',
        }),
      );
      expect(result).toEqual(updatedBoard);
    });

    it('should throw NotFoundException if board not found', async () => {
      const dto: UpdateBoardDto = { title: 'Updated Title' };
      repository.findBoardById.mockResolvedValue(null);

      await expect(service.update(mockBoardId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a board', async () => {
      const mockBoard = createMockBoard();
      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.deleteBoard.mockResolvedValue(undefined);

      const result = await service.remove(mockBoardId);

      expect(repository.findBoardById).toHaveBeenCalledWith(mockBoardId);
      expect(repository.deleteBoard).toHaveBeenCalledWith(mockBoardId);
      expect(result).toEqual({ message: 'Board deleted successfully' });
    });

    it('should throw NotFoundException if board not found', async () => {
      repository.findBoardById.mockResolvedValue(null);

      await expect(service.remove(mockBoardId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMembers', () => {
    it('should return list of board members', async () => {
      const mockBoard = createMockBoard();
      const mockMembers = [createMockBoardMember(), createMockBoardMember({ userId: 'user-789' })];

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findManyBoardMembers.mockResolvedValue(mockMembers as any);

      const result = await service.listMembers(mockBoardId);

      expect(repository.findBoardById).toHaveBeenCalledWith(mockBoardId);
      expect(repository.findManyBoardMembers).toHaveBeenCalledWith(mockBoardId);
      expect(result).toEqual(mockMembers);
    });

    it('should throw NotFoundException if board not found', async () => {
      repository.findBoardById.mockResolvedValue(null);

      await expect(service.listMembers(mockBoardId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    describe('regular member removal', () => {
      it('should allow admin to remove a member', async () => {
        const memberToRemove = 'member-789';
        const mockBoard = createMockBoard();
        const requesterMembership = createMockBoardMember({ role: Role.ADMIN });
        const targetMembership = createMockBoardMember({
          userId: memberToRemove,
          role: Role.MEMBER,
        });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findBoardMember
          .mockResolvedValueOnce(targetMembership)
          .mockResolvedValueOnce(requesterMembership);
        repository.deleteBoardMember.mockResolvedValue(undefined);

        const result = await service.removeMember(mockBoardId, memberToRemove, mockUserId);

        expect(repository.deleteBoardMember).toHaveBeenCalledWith(mockBoardId, memberToRemove);
        expect(eventEmitter.emit).toHaveBeenCalled();
        expect(result).toEqual({ message: 'Member removed successfully' });
      });

      it('should allow user to remove themselves', async () => {
        const mockBoard = createMockBoard({ ownerId: 'another-owner' });
        const membership = createMockBoardMember({ userId: mockUserId, role: Role.MEMBER });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findBoardMember.mockResolvedValue(membership);
        repository.deleteBoardMember.mockResolvedValue(undefined);

        const result = await service.removeMember(mockBoardId, mockUserId, mockUserId);

        expect(repository.deleteBoardMember).toHaveBeenCalledWith(mockBoardId, mockUserId);
        expect(result).toEqual({ message: 'Member removed successfully' });
      });

      it('should throw ForbiddenException if non-admin tries to remove another member', async () => {
        const memberToRemove = 'member-789';
        const mockBoard = createMockBoard({ ownerId: 'another-owner' });
        const requesterMembership = createMockBoardMember({ role: Role.MEMBER });
        const targetMembership = createMockBoardMember({ userId: memberToRemove });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findBoardMember
          .mockResolvedValueOnce(targetMembership)
          .mockResolvedValueOnce(requesterMembership);

        await expect(service.removeMember(mockBoardId, memberToRemove, mockUserId)).rejects.toThrow(
          'Only administrators can remove other members',
        );
      });

      it('should throw NotFoundException if member not found', async () => {
        const memberToRemove = 'member-789';
        const mockBoard = createMockBoard();

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findBoardMember.mockResolvedValue(null);

        await expect(service.removeMember(mockBoardId, memberToRemove, mockUserId)).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.removeMember(mockBoardId, memberToRemove, mockUserId)).rejects.toThrow(
          'User is not a member of this board',
        );
      });
    });

    describe('owner removal', () => {
      it('should transfer ownership to next admin when owner leaves', async () => {
        const mockBoard = createMockBoard({ ownerId: mockUserId });
        const nextAdmin = createMockBoardMember({ userId: 'admin-789' });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findNextAdmin.mockResolvedValue(nextAdmin);
        repository.transferOwnershipAndRemoveMember.mockResolvedValue(undefined);

        const result = await service.removeMember(mockBoardId, mockUserId, mockUserId);

        expect(repository.findNextAdmin).toHaveBeenCalledWith(mockBoardId, mockUserId);
        expect(repository.transferOwnershipAndRemoveMember).toHaveBeenCalledWith(
          mockBoardId,
          nextAdmin.userId,
          mockUserId,
          false,
        );
        expect(result).toEqual({
          message: 'Ownership transferred to the oldest ADMIN and member removed',
        });
      });

      it('should transfer ownership to next member (promoted to admin) when no admin exists', async () => {
        const mockBoard = createMockBoard({ ownerId: mockUserId });
        const nextMember = createMockBoardMember({ userId: 'member-789', role: Role.MEMBER });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findNextAdmin.mockResolvedValue(null);
        repository.findNextMember.mockResolvedValue(nextMember);
        repository.transferOwnershipAndRemoveMember.mockResolvedValue(undefined);

        const result = await service.removeMember(mockBoardId, mockUserId, mockUserId);

        expect(repository.findNextMember).toHaveBeenCalledWith(mockBoardId, mockUserId);
        expect(repository.transferOwnershipAndRemoveMember).toHaveBeenCalledWith(
          mockBoardId,
          nextMember.userId,
          mockUserId,
          true,
        );
        expect(result).toEqual({
          message:
            'Ownership transferred to the oldest member (promoted to ADMIN) and user removed',
        });
      });

      it('should delete board when owner is the only member', async () => {
        const mockBoard = createMockBoard({ ownerId: mockUserId });

        repository.findBoardById.mockResolvedValue(mockBoard);
        repository.findNextAdmin.mockResolvedValue(null);
        repository.findNextMember.mockResolvedValue(null);
        repository.deleteBoard.mockResolvedValue(undefined);

        const result = await service.removeMember(mockBoardId, mockUserId, mockUserId);

        expect(repository.deleteBoard).toHaveBeenCalledWith(mockBoardId);
        expect(result).toEqual({
          message: 'Board deleted, you were the only eligible member (no ADMIN/MEMBER)',
        });
      });

      it('should throw ForbiddenException if non-owner tries to remove owner', async () => {
        const mockBoard = createMockBoard({ ownerId: mockUserId });
        const anotherUser = 'user-789';

        repository.findBoardById.mockResolvedValue(mockBoard);

        await expect(service.removeMember(mockBoardId, mockUserId, anotherUser)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(service.removeMember(mockBoardId, mockUserId, anotherUser)).rejects.toThrow(
          'Cannot remove the board owner',
        );
      });
    });
  });

  describe('changeMemberRole', () => {
    it('should change member role successfully', async () => {
      const targetUserId = 'member-789';
      const dto: UpdateMemberRoleDto = { role: Role.ADMIN };
      const mockBoard = createMockBoard();
      const targetMember = createMockBoardMember({ userId: targetUserId, role: Role.MEMBER });
      const updatedMember = { ...targetMember, role: Role.ADMIN };

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findBoardMember.mockResolvedValue(targetMember);
      repository.updateBoardMemberRole.mockResolvedValue(updatedMember);

      const result = await service.changeMemberRole(mockBoardId, targetUserId, mockUserId, dto);

      expect(repository.updateBoardMemberRole).toHaveBeenCalledWith(
        mockBoardId,
        targetUserId,
        dto.role,
      );
      expect(eventEmitter.emit).toHaveBeenCalled();
      expect(result).toEqual(updatedMember);
    });

    it('should throw ForbiddenException when trying to change owner role', async () => {
      const dto: UpdateMemberRoleDto = { role: Role.MEMBER };
      const mockBoard = createMockBoard({ ownerId: mockUserId });

      repository.findBoardById.mockResolvedValue(mockBoard);

      await expect(
        service.changeMemberRole(mockBoardId, mockUserId, 'another-user', dto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.changeMemberRole(mockBoardId, mockUserId, 'another-user', dto),
      ).rejects.toThrow('Cannot change the board owner role');
    });

    it('should throw NotFoundException if target member not found', async () => {
      const targetUserId = 'member-789';
      const dto: UpdateMemberRoleDto = { role: Role.ADMIN };
      const mockBoard = createMockBoard();

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findBoardMember.mockResolvedValue(null);

      await expect(
        service.changeMemberRole(mockBoardId, targetUserId, mockUserId, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.changeMemberRole(mockBoardId, targetUserId, mockUserId, dto),
      ).rejects.toThrow('User is not a member of this board');
    });

    it('should throw BadRequestException when demoting the only admin', async () => {
      const targetUserId = 'admin-789';
      const dto: UpdateMemberRoleDto = { role: Role.MEMBER };
      const mockBoard = createMockBoard();
      const targetMember = createMockBoardMember({ userId: targetUserId, role: Role.ADMIN });

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findBoardMember.mockResolvedValue(targetMember);
      repository.countAdmins.mockResolvedValue(1);

      await expect(
        service.changeMemberRole(mockBoardId, targetUserId, mockUserId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changeMemberRole(mockBoardId, targetUserId, mockUserId, dto),
      ).rejects.toThrow('Cannot demote the only ADMIN of the board');
    });
  });

  describe('invite', () => {
    it('should send invite successfully', async () => {
      const dto: InviteBoardDto = { userName: 'testuser', role: Role.MEMBER };
      const mockBoard = createMockBoard();
      const mockUser = createMockUser();

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findUserByUsername.mockResolvedValue(mockUser);
      repository.findPendingInvite.mockResolvedValue(null);
      repository.findBoardMember.mockResolvedValue(null);
      repository.createInvite.mockResolvedValue({} as Invite);

      const result = await service.invite(mockBoardId, mockUserId, dto);

      expect(repository.findUserByUsername).toHaveBeenCalledWith(dto.userName);
      expect(repository.createInvite).toHaveBeenCalledWith(
        mockBoardId,
        mockUserId,
        mockUser.id,
        mockUser.email,
        dto.role,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.new', { userId: mockUser.id });
      expect(result).toEqual({ message: 'Invite sent successfully' });
    });

    it('should throw NotFoundException if recipient not found', async () => {
      const dto: InviteBoardDto = { userName: 'nonexistent', role: Role.MEMBER };
      const mockBoard = createMockBoard();

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findUserByUsername.mockResolvedValue(null);

      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(
        'Recipient not found',
      );
    });

    it('should throw BadRequestException if pending invite exists', async () => {
      const dto: InviteBoardDto = { userName: 'testuser', role: Role.MEMBER };
      const mockBoard = createMockBoard();
      const mockUser = createMockUser();
      const existingInvite = createMockInvite();

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findUserByUsername.mockResolvedValue(mockUser);
      repository.findPendingInvite.mockResolvedValue(existingInvite);

      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(
        'There is already a pending invite for this user',
      );
    });

    it('should throw BadRequestException if user is already a member', async () => {
      const dto: InviteBoardDto = { userName: 'testuser', role: Role.MEMBER };
      const mockBoard = createMockBoard();
      const mockUser = createMockUser();
      const existingMember = createMockBoardMember({ userId: mockUser.id });

      repository.findBoardById.mockResolvedValue(mockBoard);
      repository.findUserByUsername.mockResolvedValue(mockUser);
      repository.findPendingInvite.mockResolvedValue(null);
      repository.findBoardMember.mockResolvedValue(existingMember);

      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.invite(mockBoardId, mockUserId, dto)).rejects.toThrow(
        'This user is already a member of the board',
      );
    });
  });

  describe('responseInvite', () => {
    it('should accept invite successfully', async () => {
      const dto: ResponseInviteBoardDto = { idInvite: mockInviteId, response: true };
      const mockInvite = createMockInvite();

      repository.findInvite.mockResolvedValue(mockInvite);
      repository.acceptInviteTransaction.mockResolvedValue(undefined);

      const result = await service.responseInvite(mockBoardId, mockRecipientId, dto);

      expect(repository.findInvite).toHaveBeenCalledWith(mockInviteId);
      expect(repository.acceptInviteTransaction).toHaveBeenCalledWith(
        mockBoardId,
        mockRecipientId,
        mockInvite.role,
        mockInviteId,
      );
      expect(result).toEqual({ message: 'Invite accepted successfully' });
    });

    it('should decline invite successfully', async () => {
      const dto: ResponseInviteBoardDto = { idInvite: mockInviteId, response: false };
      const mockInvite = createMockInvite();

      repository.findInvite.mockResolvedValue(mockInvite);
      repository.deleteInvite.mockResolvedValue(undefined);

      const result = await service.responseInvite(mockBoardId, mockRecipientId, dto);

      expect(repository.findInvite).toHaveBeenCalledWith(mockInviteId);
      expect(repository.deleteInvite).toHaveBeenCalledWith(mockInviteId);
      expect(result).toEqual({ message: 'Invite declined successfully' });
    });

    it('should throw NotFoundException if invite not found', async () => {
      const dto: ResponseInviteBoardDto = { idInvite: mockInviteId, response: true };

      repository.findInvite.mockResolvedValue(null);

      await expect(service.responseInvite(mockBoardId, mockRecipientId, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.responseInvite(mockBoardId, mockRecipientId, dto)).rejects.toThrow(
        'Invite not found',
      );
    });

    it('should throw ForbiddenException if user is not the recipient', async () => {
      const dto: ResponseInviteBoardDto = { idInvite: mockInviteId, response: true };
      const mockInvite = createMockInvite({ recipientId: 'different-user' });

      repository.findInvite.mockResolvedValue(mockInvite);

      await expect(service.responseInvite(mockBoardId, mockRecipientId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.responseInvite(mockBoardId, mockRecipientId, dto)).rejects.toThrow(
        'You do not have permission to accept this invite',
      );
    });
  });
});
