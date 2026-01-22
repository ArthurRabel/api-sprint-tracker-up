import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider } from '@prisma/client';
import { Response } from 'express';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { AuthenticatedUser } from '@/common/interfaces/user.interface';
import { ForgotPasswordDto } from '@/email/dto/forgot-password.dto';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LdapLoginDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  VerifyResetCodeDto,
} from './dto';
import { ProviderUser } from './interface/oauth';
import { ResetPasswordGuard } from './guards/reset-password.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: DeepMockProxy<AuthService>;
  let configService: DeepMockProxy<ConfigService>;
  let jwtService: DeepMockProxy<JwtService>;
  let resetPasswordGuard: { canActivate: jest.Mock };

  const accessToken = 'mockAccessToken';
  const frontendUrl = 'http://frontend.example';

  const createResponseMock = () => {
    const res = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    } as unknown as Response;
    return res;
  };

  beforeEach(async () => {
    authService = mockDeep<AuthService>();
    configService = mockDeep<ConfigService>();
    jwtService = mockDeep<JwtService>();
    resetPasswordGuard = { canActivate: jest.fn().mockReturnValue(true) };

    configService.getOrThrow.mockReturnValue(frontendUrl);
    configService.get.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: ResetPasswordGuard, useValue: resetPasswordGuard },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    const dto: SignUpDto = {
      email: 'new@example.com',
      password: 'Password123!',
      name: 'New User',
      userName: 'newuser',
    };

    it('sets cookie and returns created message', async () => {
      const res = createResponseMock();
      authService.signUp.mockResolvedValue({ accessToken });

      await controller.signUp(dto, res);

      expect(authService.signUp).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'sprinttacker-session',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          expires: expect.any(Date),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith({ message: 'User registered successfully' });
    });
  });

  describe('signIn', () => {
    const dto: SignInDto = {
      email: 'user@example.com',
      password: 'Password123!',
      rememberMe: false,
    };

    it('sets short-lived cookie for default sign-in', async () => {
      const res = createResponseMock();
      authService.signIn.mockResolvedValue({ accessToken });

      await controller.signIn(dto, res);

      expect(authService.signIn).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'sprinttacker-session',
        accessToken,
        expect.objectContaining({
          expires: expect.any(Date),
          secure: false,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'User authenticated successfully' });
    });

    it('sets long-lived cookie when rememberMe is true', async () => {
      const res = createResponseMock();
      const rememberDto = { ...dto, rememberMe: true };
      authService.signIn.mockResolvedValue({ accessToken });

      await controller.signIn(rememberDto, res);

      const [, , options] = (res.cookie as jest.Mock).mock.calls[0];
      const expires = (options as { expires: Date }).expires;

      expect(expires.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000);
    });
  });

  describe('forgotPassword', () => {
    const dto: ForgotPasswordDto = { email: 'user@example.com' };

    it('triggers password recovery flow', async () => {
      authService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'If the email is registered, password recovery instructions have been sent.',
      });
    });
  });

  describe('verifyResetCode', () => {
    const dto: VerifyResetCodeDto = { code: 'reset-code' };

    it('stores reset token cookie and returns message', async () => {
      const res = createResponseMock();
      authService.verifyResetCode.mockResolvedValue('reset-jwt');

      const result = await controller.verifyResetCode(dto, res);

      expect(authService.verifyResetCode).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'reset-token',
        'reset-jwt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/v1/auth/reset-password',
          maxAge: 15 * 60 * 1000,
        }),
      );
      expect(result).toEqual({
        message: 'Code verified successfully. You can reset your password.',
      });
    });
  });

  describe('resetPassword', () => {
    const dto: ResetPasswordDto = {
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    } as ResetPasswordDto;
    const user: AuthenticatedUser = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      userName: 'testuser',
      role: 'MEMBER',
      authProvider: 'LOCAL',
    };

    it('delegates password reset to service', async () => {
      authService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto, user);

      expect(authService.resetPassword).toHaveBeenCalledWith('user-id', dto.newPassword);
      expect(result).toEqual({ message: 'Password reset successfully!' });
    });
  });

  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      oldPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    };

    it('changes password for authenticated user', async () => {
      authService.changePassword.mockResolvedValue(undefined);
        const req = { user: { id: 'user-id' } };

      const result = await controller.changePassword(req, dto);

      expect(authService.changePassword).toHaveBeenCalledWith('user-id', dto);
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });

  describe('googleAuthRedirect', () => {
    const user: ProviderUser = {
      providerId: 'google-123',
      email: 'user@example.com',
      name: 'Google User',
    };

    it('redirects to dashboard with session cookie on success', async () => {
      const res = createResponseMock();
      authService.signInWithProvider.mockResolvedValue({ accessToken });

      await controller.googleAuthRedirect({ user }, res);

      expect(authService.signInWithProvider).toHaveBeenCalledWith(AuthProvider.GOOGLE, {
        providerId: user.providerId,
        email: user.email,
        name: user.name,
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'sprinttacker-session',
        accessToken,
        expect.objectContaining({ secure: false }),
      );
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/dashboard`);
    });

    it('redirects to error page when data is incomplete', async () => {
      const res = createResponseMock();

        await controller.googleAuthRedirect({
          user: {
            providerId: '',
            email: '',
            name: '' 
          }
        }, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/error?message=incomplete_google_data`,
      );
    });

  });

  describe('microsoftAuthRedirect', () => {
    const user: ProviderUser = {
      providerId: 'ms-123',
      email: 'ms@example.com',
      name: 'MS User',
    };

    it('redirects to dashboard with session cookie on success', async () => {
      const res = createResponseMock();
      authService.signInWithProvider.mockResolvedValue({ accessToken });

      await controller.microsoftAuthRedirect({ user }, res);

      expect(authService.signInWithProvider).toHaveBeenCalledWith(AuthProvider.MICROSOFT, {
        providerId: user.providerId,
        email: user.email,
        name: user.name,
      });
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/dashboard`);
    });

    it('redirects to error page when data is incomplete', async () => {
      const res = createResponseMock();

        await controller.microsoftAuthRedirect({
          user: {
            providerId: '',
            email: '',
            name: '' 
          }
        }, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/error?message=incomplete_microsoft_data`,
      );
    });
  });

  describe('ldapLogin', () => {
    const dto: LdapLoginDto = { enrollment: '12345', password: 'secret' } as LdapLoginDto;
    const ldapUser = { uid: 'ldap-uid', mail: 'ldap@example.com', displayName: 'LDAP User' };

    it('authenticates via LDAP and sets cookie', async () => {
      const res = createResponseMock();
        authService.authenticateLdap.mockResolvedValue(ldapUser);
      authService.signInWithProvider.mockResolvedValue({ accessToken });

      const result = await controller.ldapLogin(dto, res);

      expect(authService.authenticateLdap).toHaveBeenCalledWith(dto.enrollment, dto.password);
      expect(authService.signInWithProvider).toHaveBeenCalledWith(AuthProvider.LDAP, {
        providerId: ldapUser.uid,
        email: ldapUser.mail,
        name: ldapUser.displayName,
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'sprinttacker-session',
        accessToken,
        expect.objectContaining({ secure: false }),
      );
      expect(result).toEqual({
        message: 'LDAP login successful. Token stored in cookie.',
        user: { name: ldapUser.displayName, email: ldapUser.mail },
      });
    });
  });

  describe('logout', () => {
    it('clears cookie and returns logout message', () => {
      const res = createResponseMock();

      const result = controller.logout(res);

      expect((res.clearCookie as jest.Mock).mock.calls.length).toBe(1);
      expect(res.clearCookie).toHaveBeenCalledWith('sprinttacker-session', {
        httpOnly: true,
        path: '/',
        secure: false,
        sameSite: 'lax',
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logout successful' });
      expect(result).toBeDefined();
    });
  });
});
