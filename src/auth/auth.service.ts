import { randomBytes } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, Role, AuthProvider } from '@prisma/client';
import * as argon2 from 'argon2';
import { Client } from 'ldapts';

import 'dotenv/config';
import { ChangePasswordDto, SignInDto, SignUpDto, VerifyResetCodeDto } from '@/auth/dto';
import { ForgotPasswordDto } from '@/email/dto/forgot-password.dto';
import { EmailService } from '@/email/email.service';
import { PrismaService } from '@/prisma/prisma.service';

import { AccessTokenPayload } from './interface/jwt';

import type { SearchOptions } from 'ldapts';

@Injectable()
export class AuthService {
  private readonly userBaseDn: string;
  private readonly ldapUrl: string;
  private readonly ldapAdminDn: string;
  private readonly ldapAdminPassword: string;
  private readonly jwtResetSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {
    this.userBaseDn = this.configService.getOrThrow<string>('LDAP_USER_BASE_DN');
    this.ldapUrl = this.configService.getOrThrow<string>('LDAP_URL');
    this.ldapAdminDn = this.configService.getOrThrow<string>('LDAP_ADMIN_DN');
    this.ldapAdminPassword = this.configService.getOrThrow<string>('LDAP_ADMIN_PASSWORD');
    this.jwtResetSecret = this.configService.getOrThrow<string>('JWT_RESET_SECRET');
  }

  private generateJwt(user: User, rememberMe = false): { accessToken: string } {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      userName: user.userName,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? '30d' : '1d',
        algorithm: 'HS256',
      }),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  private async createUser(
    data: {
      email: string;
      name: string;
      providerId?: string;
      password?: string;
    },
    provider: AuthProvider,
  ): Promise<User> {
    const { name, email, providerId, password } = data;
    const userData = {
      email,
      name,
      userName: data.email.split('@')[0],
      passwordHash: provider === AuthProvider.LOCAL ? data.password! : null,
      providerId: provider === AuthProvider.LOCAL ? null : data.providerId!,
      role: Role.MEMBER,
      authProvider: provider,
    };

    return this.prisma.user.create({
      data: userData,
    });
  }

  async signUp(dto: SignUpDto): Promise<{ accessToken: string }> {
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingUserByUserName = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });
    if (existingUserByUserName) {
      throw new ConflictException('Username already in use');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const user = await this.createUser({ ...dto, password: hashedPassword }, AuthProvider.LOCAL);
    return this.generateJwt(user);
  }

  async signIn(dto: SignInDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const isInvalidUser = !user || !user.passwordHash || user.authProvider !== AuthProvider.LOCAL;

    if (isInvalidUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isInvalidCredentials = !(await argon2.verify(user.passwordHash!, dto.password));
    if (isInvalidCredentials) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateJwt(user, dto.rememberMe);
  }

  async signInWithProvider(
    provider: AuthProvider,
    data: { providerId: string; email: string; name: string },
  ): Promise<{ accessToken: string }> {
    const { email, name, providerId } = data;
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.createUser({ email, name, providerId }, provider);
    }

    return this.generateJwt(user);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return;
    }

    const code = randomBytes(6).toString('base64');
    const expires = new Date(Date.now() + 1000 * 60 * 15);

    await this.prisma.user.update({
      where: { email },
      data: {
        resetToken: code,
        resetTokenExpiresAt: expires,
      },
    });

    await this.emailService.sendForgotPasswordEmail(email, code);
  }

  async verifyResetCode(verifyResetCodeDto: VerifyResetCodeDto): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: verifyResetCodeDto.code },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired code.');
    }

    if (!user.resetToken || user.resetToken !== verifyResetCodeDto.code) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
      throw new UnauthorizedException('Verification code expired.');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      purpose: 'reset-password',
    };

    const resetJwtToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.jwtResetSecret,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return resetJwtToken;
  }

  async validateUserFromToken(token: string): Promise<User | null> {
    try {
      const decoded = this.jwtService.verify<AccessTokenPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      return user || null;
    } catch {
      return null;
    }
  }

  async resetPassword(userId: string, newPasswordPlain: string): Promise<void> {
    try {
      const hashedPassword = await this.hashPassword(newPasswordPlain);

      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });
    } catch (error) {
      throw new BadRequestException('Error resetting password: ' + String(error));
    }
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Password change is not allowed for users registered via OAuth or LDAP.',
      );
    }

    const isOldPasswordValid = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Incorrect old password.');
    }

    const hashedNewPassword = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hashedNewPassword },
    });
  }

  async authenticateLdap(
    enrollment: string, password: string
  ): Promise<{
    uid: string;
    displayName: string;
    mail: string;
  }> {
    const cleanPassword = password.trim();

    const userDN = await this.findUserDn(enrollment);
    if (!userDN) {
      throw new UnauthorizedException('User not found in LDAP directory.');
    }

    const userClient = new Client({
      url: this.ldapUrl,
    });

    try {
      await userClient.bind(userDN, cleanPassword);

      const userAttributes = await this.getUserAttributes(userDN);

      return {
        uid: userAttributes.uid,
        displayName: userAttributes.displayName,
        mail: userAttributes.mail,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 49
      ) {
        throw new UnauthorizedException('Invalid LDAP credentials.');
      }
      throw new InternalServerErrorException('Error communicating with LDAP server.');
    } finally {
      await userClient.unbind().catch(() => { });
    }
  }

  private async getBoundAdminClient(): Promise<Client> {
    const client = new Client({
      url: this.ldapUrl,
    });

    await client.bind(this.ldapAdminDn, this.ldapAdminPassword);
    return client;
  }

  private async findUserDn(enrollment: string): Promise<string | null> {
    const adminClient = await this.getBoundAdminClient();

    try {
      const searchOptions: SearchOptions = {
        filter: `(uid=${enrollment})`,
        scope: 'sub',
        attributes: ['dn'],
      };

      const { searchEntries } = await adminClient.search(this.userBaseDn, searchOptions);

      return searchEntries.length > 0 ? searchEntries[0].dn : null;
    } catch {
      throw new InternalServerErrorException('LDAP configuration error: failed to search user DN.');
    } finally {
      await adminClient.unbind().catch(() => { });
    }
  }

  private async getUserAttributes(
    userDN: string
  ): Promise<{
    uid: string;
    displayName: string;
    mail: string;
  }> {
    const adminClient = await this.getBoundAdminClient();

    try {
      const { searchEntries } = await adminClient.search(userDN, {
        scope: 'base',
        attributes: ['cn', 'mail', 'uid', 'memberOf'],
      });

      if (searchEntries.length > 0) {
        const entry = searchEntries[0];
        return {
          uid: this.extractLdapAttribute(entry.uid),
          displayName: this.extractLdapAttribute(entry.cn),
          mail: this.extractLdapAttribute(entry.mail),
        };
      }
      throw new InternalServerErrorException(
        'LDAP user attributes not found after successful BIND.',
      );
    } finally {
      await adminClient.unbind().catch(() => { });
    }
  }

  private extractLdapAttribute(value: string | string[] | Buffer | Buffer[] | undefined): string {
    if (Array.isArray(value)) {
      return this.extractLdapAttribute(value[0]);
    }
    if (Buffer.isBuffer(value)) {
      return value.toString();
    }
    return String(value ?? '');
  }
}
