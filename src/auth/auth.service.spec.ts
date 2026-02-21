import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { UserService } from '@/user/user.service';

import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SignUpDto, SignInDto, ChangePasswordDto, VerifyResetCodeDto } from './dto';
import { AuthProvider, Role, User } from './types/auth.types';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: DeepMockProxy<AuthRepository>;
  let configService: DeepMockProxy<ConfigService>;
  let jwtService: DeepMockProxy<JwtService>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;
  let userService: DeepMockProxy<UserService>;

  const mockUserId = '6217183c-bc01-4bca-8aa0-271b7f9761c5';
  const mockEmail = 'user@example.com';
  const mockPassword = 'password123';
  const mockHashedPassword = 'hashed_password123';
  const mockAccessToken = 'mockAccessToken';

  const createMockUser = (overrides = {}): User => ({
    id: mockUserId,
    email: mockEmail,
    name: 'Test User',
    userName: 'testuser',
    passwordHash: mockHashedPassword,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockDeep<AuthRepository>() },
        { provide: JwtService, useValue: mockDeep<JwtService>() },
        { provide: ConfigService, useValue: mockDeep<ConfigService>() },
        { provide: EventEmitter2, useValue: mockDeep<EventEmitter2>() },
        { provide: UserService, useValue: mockDeep<UserService>() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AuthRepository);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    eventEmitter = module.get(EventEmitter2);
    userService = module.get(UserService);

    configService.getOrThrow.mockReturnValue('mock-value');
    configService.get.mockImplementation((key: string) => {
      if (key === 'ENABLE_LDAP_OAUTH') {
        return 'false';
      }
      return 'mock-value';
    });
    jwtService.sign.mockReturnValue(mockAccessToken);

    jest.clearAllMocks();
  });

  describe('signUp', () => {
    const signUpDto: SignUpDto = {
      email: 'newuser@example.com',
      password: mockPassword,
      name: 'New User',
      userName: 'newuser',
    };

    it('should create a new user and return an access token', async () => {
      const mockUser = createMockUser({
        email: signUpDto.email,
        name: signUpDto.name,
        userName: signUpDto.userName,
      });

      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.findUserByUsername.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(mockUser);
      (argon2.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      const result = await service.signUp(signUpDto);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(signUpDto.email);
      expect(userService.createUser).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', mockUser);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      const mockUser = createMockUser({ email: signUpDto.email });
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        new ConflictException('Email already in use'),
      );
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      const mockUser = createMockUser({ userName: signUpDto.userName });
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.findUserByUsername.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        new ConflictException('Username already in use'),
      );
      expect(userService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    const signInDto: SignInDto = {
      email: mockEmail,
      password: mockPassword,
      rememberMe: false,
    };

    it('should successfully sign in and return access token', async () => {
      const mockUser = createMockUser();
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn(signInDto);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(signInDto.email);
      expect(argon2.verify).toHaveBeenCalledWith(mockHashedPassword, mockPassword);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should sign in with rememberMe option', async () => {
      const mockUser = createMockUser();
      const signInWithRemember = { ...signInDto, rememberMe: true };

      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.signIn(signInWithRemember);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '30d' }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      const mockUser = createMockUser({ passwordHash: null });
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if user is not LOCAL provider', async () => {
      const mockUser = createMockUser({ authProvider: AuthProvider.GOOGLE });
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const mockUser = createMockUser();
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('signInWithProvider', () => {
    const providerData = {
      providerId: 'google-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
    };

    it('should create new user and return token for new OAuth user', async () => {
      const newUser = createMockUser({
        id: 'id',
        email: providerData.email,
        name: providerData.name,
        providerId: providerData.providerId,
        authProvider: AuthProvider.GOOGLE,
        passwordHash: null,
      });

      authRepository.findUserByEmail.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(newUser);

      const result = await service.signInWithProvider(AuthProvider.GOOGLE, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(providerData.email);
      expect(userService.createUser).toHaveBeenCalledWith(
        { email: providerData.email, name: providerData.name, providerId: providerData.providerId },
        AuthProvider.GOOGLE,
      );
    });

    it('should return token for existing OAuth user', async () => {
      const existingUser = createMockUser({
        email: providerData.email,
        authProvider: AuthProvider.GOOGLE,
      });

      authRepository.findUserByEmail.mockResolvedValue(existingUser);

      const result = await service.signInWithProvider(AuthProvider.GOOGLE, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should work with MICROSOFT provider', async () => {
      const newUser = createMockUser({
        email: providerData.email,
        authProvider: AuthProvider.MICROSOFT,
      });

      authRepository.findUserByEmail.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(newUser);

      const result = await service.signInWithProvider(AuthProvider.MICROSOFT, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(userService.createUser).toHaveBeenCalledWith(
        { email: providerData.email, name: providerData.name, providerId: providerData.providerId },
        AuthProvider.MICROSOFT,
      );
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = { email: mockEmail };

    it('should generate reset token and emit event', async () => {
      const mockUser = createMockUser();
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      authRepository.updateUserResetToken.mockResolvedValue(undefined);

      await service.forgotPassword(forgotPasswordDto);

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(mockEmail);
      expect(authRepository.updateUserResetToken).toHaveBeenCalledWith(
        mockEmail,
        expect.any(String),
        expect.any(Date),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.forgotPassword',
        expect.objectContaining({
          email: mockEmail,
          resetToken: expect.any(String),
        }),
      );
    });

    it('should do nothing if user not found (security)', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await service.forgotPassword(forgotPasswordDto);

      expect(authRepository.updateUserResetToken).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('verifyResetCode', () => {
    const verifyDto: VerifyResetCodeDto = { code: 'valid-code' };
    const resetJwtToken = 'reset-jwt-token';

    it('should verify code and return JWT reset token', async () => {
      const mockUser = createMockUser({
        resetToken: 'valid-code',
        resetTokenExpiresAt: new Date(Date.now() + 10000),
      });

      authRepository.findUserByResetToken.mockResolvedValue(mockUser);
      authRepository.clearUserResetToken.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue(resetJwtToken);

      const result = await service.verifyResetCode(verifyDto);

      expect(result).toBe(resetJwtToken);
      expect(authRepository.clearUserResetToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      authRepository.findUserByResetToken.mockResolvedValue(null);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired code.'),
      );
    });

    it('should throw UnauthorizedException if code does not match', async () => {
      const mockUser = createMockUser({
        resetToken: 'different-code',
        resetTokenExpiresAt: new Date(Date.now() + 10000),
      });
      authRepository.findUserByResetToken.mockResolvedValue(mockUser);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Invalid verification code.'),
      );
    });

    it('should throw UnauthorizedException if code is expired', async () => {
      const mockUser = createMockUser({
        resetToken: 'valid-code',
        resetTokenExpiresAt: new Date(Date.now() - 1000),
      });
      authRepository.findUserByResetToken.mockResolvedValue(mockUser);
      authRepository.clearUserResetToken.mockResolvedValue(undefined);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Verification code expired.'),
      );
      expect(authRepository.clearUserResetToken).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('validateUserFromToken', () => {
    const validToken = 'valid-jwt-token';

    it('should return user if token is valid', async () => {
      const mockUser = createMockUser();
      jwtService.verify.mockReturnValue({ sub: mockUserId });
      authRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.validateUserFromToken(validToken);

      expect(result).toEqual(mockUser);
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(authRepository.findUserById).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null if token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateUserFromToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUserId });
      authRepository.findUserById.mockResolvedValue(null);

      const result = await service.validateUserFromToken(validToken);

      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    const newPassword = 'newPassword123';

    it('should hash and update user password', async () => {
      const mockUser = createMockUser();
      authRepository.findUserById.mockResolvedValue(mockUser);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      authRepository.updateUserPassword.mockResolvedValue(undefined);

      await service.resetPassword(mockUserId, newPassword);

      expect(argon2.hash).toHaveBeenCalledWith(newPassword, expect.any(Object));
      expect(authRepository.updateUserPassword).toHaveBeenCalledWith(
        mockUserId,
        'new-hashed-password',
      );
    });

    it('should throw BadRequestException on error', async () => {
      authRepository.findUserById.mockRejectedValue(new Error('Database error'));

      await expect(service.resetPassword(mockUserId, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: mockPassword,
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    };

    it('should change password successfully', async () => {
      const mockUser = createMockUser();
      authRepository.findUserById.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      authRepository.updateUserPassword.mockResolvedValue(undefined);

      await service.changePassword(mockUserId, changePasswordDto);

      expect(authRepository.findUserById).toHaveBeenCalledWith(mockUserId);
      expect(argon2.verify).toHaveBeenCalledWith(mockHashedPassword, changePasswordDto.oldPassword);
      expect(authRepository.updateUserPassword).toHaveBeenCalledWith(
        mockUserId,
        'new-hashed-password',
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.changePassword', mockUser);
    });

    it('should throw BadRequestException if user not found', async () => {
      authRepository.findUserById.mockResolvedValue(null);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException('User not found.'),
      );
    });

    it('should throw BadRequestException if user has no password hash (OAuth user)', async () => {
      const mockUser = createMockUser({ passwordHash: null });
      authRepository.findUserById.mockResolvedValue(mockUser);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException(
          'Password change is not allowed for users registered via OAuth or LDAP.',
        ),
      );
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      const mockUser = createMockUser();
      authRepository.findUserById.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException('Incorrect old password.'),
      );
      expect(authRepository.updateUserPassword).not.toHaveBeenCalled();
    });
  });
});
