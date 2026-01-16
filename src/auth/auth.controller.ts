import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  UseGuards,
  Res,
  Patch,
  Request,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from '@/auth/auth.service';
import {
  ChangePasswordDto,
  LdapLoginDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  VerifyResetCodeDto,
} from '@/auth/dto';
import { IsEnabledAuthGuard } from '@/auth/guards/is-enable-oauth.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { ResetPasswordGuard } from '@/auth/guards/reset-password.guard';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';
import { ForgotPasswordDto } from '@/email/dto/forgot-password.dto';

import {
  SignUpDocs,
  SignInDocs,
  GoogleAuthDocs,
  GoogleCallbackDocs,
  MicrosoftAuthDocs,
  MicrosoftCallbackDocs,
  ForgotPasswordDocs,
  ResetPasswordDocs,
  VerifyResetCodeDocs,
  ChangePasswordDocs,
  LogoutDocs,
  LdapLoginDocs,
} from './auth.docs';

@Throttle({
  short: { limit: 2, ttl: 1000 },
  long: { limit: 5, ttl: 60000 }
})
@ApiTags('Authentication and Authorization')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly frontendUrl: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  private setCookieOptions(rememberMe = false) {
    const expirationTime = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 24 * 60 * 60 * 1000; // 1 day

    return {
      httpOnly: true,
      path: '/',
      secure: this.isProduction,
      sameSite: 'lax' as const,
      expires: new Date(Date.now() + expirationTime),
    };
  }

  @SignUpDocs()
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  async signUp(@Body() dto: SignUpDto, @Res() res: Response) {
    const result = await this.authService.signUp(dto);

    return res
      .cookie('sprinttacker-session', result.accessToken, this.setCookieOptions(false))
      .status(HttpStatus.CREATED)
      .json({ message: 'User registered successfully' });
  }

  @SignInDocs()
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signIn(@Body() dto: SignInDto, @Res() res: Response) {
    const result = await this.authService.signIn(dto);

    return res
      .cookie('sprinttacker-session', result.accessToken, this.setCookieOptions(dto.rememberMe))
      .status(HttpStatus.OK)
      .json({ message: 'User authenticated successfully' });
  }

  @ForgotPasswordDocs()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return {
      message: 'If the email is registered, password recovery instructions have been sent.',
    };
  }

  @VerifyResetCodeDocs()
  @HttpCode(HttpStatus.OK)
  @Post('verify-reset-code')
  async verifyResetCode(
    @Body() verifyResetCodeDto: VerifyResetCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resetJwtToken = await this.authService.verifyResetCode(verifyResetCodeDto);

    res.cookie('reset-token', resetJwtToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/v1/auth/reset-password',
    });

    return {
      message: 'Code verified successfully. You can reset your password.',
    };
  }

  @ResetPasswordDocs()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ResetPasswordGuard)
  @Post('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authService.resetPassword(user.id, resetPasswordDto.newPassword);
    return { message: 'Password reset successfully!' };
  }

  @ApiCookieAuth()
  @ChangePasswordDocs()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('change-password')
  async changePassword(@Request() req: { user: { id: string } }, @Body() dto: ChangePasswordDto) {
    const userId = req.user.id;
    await this.authService.changePassword(userId, dto);

    return { message: 'Password changed successfully' };
  }

  @GoogleAuthDocs()
  @UseGuards(IsEnabledAuthGuard('google', 'ENABLE_GOOGLE_OAUTH'))
  @Get('google')
  async googleAuth() {
    // Starts Google authentication flow (redirect handled by AuthGuard)
  }

  @GoogleCallbackDocs()
  @Get('google/callback')
  @UseGuards(IsEnabledAuthGuard('google', 'ENABLE_GOOGLE_OAUTH'))
  async googleAuthRedirect(
    @Req()
    req: {
      user: {
        googleId: string;
        email: string;
        name: string;
        accessToken: string;
      };
    },
    @Res() res: Response,
  ) {
    try {
      const { user } = req;

      if (!user || !user.googleId || !user.email) {
        return res.redirect(`${this.frontendUrl}/auth/error?message=incomplete_google_data`);
      }

      const authResult = await this.authService.signInWithProvider(AuthProvider.GOOGLE, {
        providerId: user.googleId,
        email: user.email,
        name: user.name,
      });

      if (!authResult?.accessToken) {
        throw new Error('Access token not generated');
      }

      return res
        .cookie('sprinttacker-session', authResult.accessToken, this.setCookieOptions(false))
        .redirect(`${this.frontendUrl}/dashboard`);
    } catch {
      return res.redirect(`${this.frontendUrl}/auth/error?message=google_login_failed`);
    }
  }

  @MicrosoftAuthDocs()
  @Get('microsoft')
  @UseGuards(IsEnabledAuthGuard('microsoft', 'ENABLE_MICROSOFT_OAUTH'))
  async microsoftAuth() {
    // Starts Microsoft authentication flow (redirect handled by AuthGuard)
  }

  @MicrosoftCallbackDocs()
  @Get('microsoft/callback')
  @UseGuards(IsEnabledAuthGuard('microsoft', 'ENABLE_MICROSOFT_OAUTH'))
  async microsoftAuthRedirect(
    @Req()
    req: {
      user: {
        microsoftId: string;
        email: string;
        name: string;
        access_token: string;
      };
    },
    @Res() res: Response,
  ) {
    try {
      const { user } = req;

      if (!user || !user.microsoftId || !user.email) {
        return res.redirect(`${this.frontendUrl}/auth/error?message=incomplete_microsoft_data`);
      }

      const authResult = await this.authService.signInWithProvider(AuthProvider.MICROSOFT, {
        providerId: user.microsoftId,
        email: user.email,
        name: user.name,
      });

      if (!authResult?.accessToken) {
        throw new Error('Access token not generated');
      }

      return res
        .cookie('sprinttacker-session', authResult.accessToken, this.setCookieOptions(false))
        .redirect(`${this.frontendUrl}/dashboard`);
    } catch {
      return res.redirect(`${this.frontendUrl}/auth/error?message=microsoft_login_failed`);
    }
  }

  @LdapLoginDocs()
  @HttpCode(HttpStatus.OK)
  @Post('signin-ldap')
  async ldapLogin(
    @Body() loginRequest: LdapLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    const { enrollment, password } = loginRequest;

    const ldapUserAttributes = await this.authService.authenticateLdap(enrollment, password);

    const { accessToken } = await this.authService.signInWithProvider(AuthProvider.LDAP, {
      providerId: ldapUserAttributes.uid,
      email: ldapUserAttributes.mail,
      name: ldapUserAttributes.displayName,
    });

    response.cookie('sprinttacker-session', accessToken, this.setCookieOptions(false));

    return {
      message: 'LDAP login successful. Token stored in cookie.',
      user: {
        name: ldapUserAttributes.displayName,
        email: ldapUserAttributes.mail,
      },
    };
  }

  @ApiCookieAuth()
  @LogoutDocs()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res() res: Response) {
    return res
      .clearCookie('sprinttacker-session', {
        httpOnly: true,
        path: '/',
        secure: this.isProduction,
        sameSite: 'lax',
      })
      .status(HttpStatus.OK)
      .json({ message: 'Logout successful' });
  }
}
