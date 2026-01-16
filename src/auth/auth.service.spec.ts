import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, AuthProvider, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { EmailService } from '@/email/email.service';
import { PrismaService } from '@/prisma/prisma.service';

import { AuthService } from './auth.service';
import { SignUpDto, SignInDto, ChangePasswordDto, VerifyResetCodeDto } from './dto';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let configService: DeepMockProxy<ConfigService>;
  let jwtService: DeepMockProxy<JwtService>;
  let emailService: DeepMockProxy<EmailService>;

  const mockUserId = '6217183c-bc01-4bca-8aa0-271b7f9761c5';
  const mockEmail = 'user@example.com';
  const mockPassword = 'password123';
  const mockHashedPassword = 'hashed_password123';
  const mockAccessToken = 'mockAccessToken';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    email: mockEmail,
    name: 'Test User',
    userName: 'testuser',
    passwordHash: mockHashedPassword,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: JwtService, useValue: mockDeep<JwtService>() },
        { provide: ConfigService, useValue: mockDeep<ConfigService>() },
        { provide: EmailService, useValue: mockDeep<EmailService>() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    emailService = module.get(EmailService);

    configService.getOrThrow.mockReturnValue('mock-value');
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

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      (argon2.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      const result = await service.signUp(signUpDto);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: signUpDto.email },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      const mockUser = createMockUser({ email: signUpDto.email });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        new ConflictException('Email already in use'),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      const mockUser = createMockUser({ userName: signUpDto.userName });
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        new ConflictException('Username already in use'),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
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
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn(signInDto);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: signInDto.email },
      });
      expect(argon2.verify).toHaveBeenCalledWith(mockHashedPassword, mockPassword);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should sign in with rememberMe option', async () => {
      const mockUser = createMockUser();
      const signInWithRemember = { ...signInDto, rememberMe: true };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.signIn(signInWithRemember);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '30d' }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      const mockUser = createMockUser({ passwordHash: null });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if user is not LOCAL provider', async () => {
      const mockUser = createMockUser({ authProvider: AuthProvider.GOOGLE });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const mockUser = createMockUser();
      prisma.user.findUnique.mockResolvedValue(mockUser);
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
        email: providerData.email,
        name: providerData.name,
        providerId: providerData.providerId,
        authProvider: AuthProvider.GOOGLE,
        passwordHash: null,
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);

      const result = await service.signInWithProvider(AuthProvider.GOOGLE, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: providerData.email },
      });
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should return token for existing OAuth user', async () => {
      const existingUser = createMockUser({
        email: providerData.email,
        authProvider: AuthProvider.GOOGLE,
      });

      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.signInWithProvider(AuthProvider.GOOGLE, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should work with MICROSOFT provider', async () => {
      const newUser = createMockUser({
        email: providerData.email,
        authProvider: AuthProvider.MICROSOFT,
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);

      const result = await service.signInWithProvider(AuthProvider.MICROSOFT, providerData);

      expect(result).toEqual({ accessToken: mockAccessToken });
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = { email: mockEmail };

    it('should generate reset token and send email', async () => {
      const mockUser = createMockUser();
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      await service.forgotPassword(forgotPasswordDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockEmail },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: mockEmail },
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(emailService.sendForgotPasswordEmail).toHaveBeenCalledWith(
        mockEmail,
        expect.any(String),
      );
    });

    it('should do nothing if user not found (security)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword(forgotPasswordDto);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(emailService.sendForgotPasswordEmail).not.toHaveBeenCalled();
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

      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue(resetJwtToken);

      const result = await service.verifyResetCode(verifyDto);

      expect(result).toBe(resetJwtToken);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired code.'),
      );
    });

    it('should throw UnauthorizedException if code does not match', async () => {
      const mockUser = createMockUser({
        resetToken: 'different-code',
        resetTokenExpiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Invalid verification code.'),
      );
    });

    it('should throw UnauthorizedException if code is expired', async () => {
      const mockUser = createMockUser({
        resetToken: 'valid-code',
        resetTokenExpiresAt: new Date(Date.now() - 1000),
      });
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      await expect(service.verifyResetCode(verifyDto)).rejects.toThrow(
        new UnauthorizedException('Verification code expired.'),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    });
  });

  describe('validateUserFromToken', () => {
    const validToken = 'valid-jwt-token';

    it('should return user if token is valid', async () => {
      const mockUser = createMockUser();
      jwtService.verify.mockReturnValue({ sub: mockUserId });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUserFromToken(validToken);

      expect(result).toEqual(mockUser);
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
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
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUserFromToken(validToken);

      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    const newPassword = 'newPassword123';

    it('should hash and update user password', async () => {
      const mockUser = createMockUser();
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(mockUser);

      await service.resetPassword(mockUserId, newPassword);

      expect(argon2.hash).toHaveBeenCalledWith(newPassword, expect.any(Object));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw BadRequestException on error', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));

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
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(mockUser);

      await service.changePassword(mockUserId, changePasswordDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(argon2.verify).toHaveBeenCalledWith(mockHashedPassword, changePasswordDto.oldPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException('User not found.'),
      );
    });

    it('should throw BadRequestException if user has no password hash (OAuth user)', async () => {
      const mockUser = createMockUser({ passwordHash: null });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException(
          'Password change is not allowed for users registered via OAuth or LDAP.',
        ),
      );
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      const mockUser = createMockUser();
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new BadRequestException('Incorrect old password.'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
