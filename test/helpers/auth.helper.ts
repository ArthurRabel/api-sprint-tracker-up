import { Server } from 'http';

import { INestApplication } from '@nestjs/common';
import { AuthProvider, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';

import { getPrismaClient } from './database.helper';

export interface TestUser {
  id: string;
  email: string;
  userName: string;
  name: string;
  passwordHash: string;
  role: Role;
  authProvider: AuthProvider;
  isVerified: boolean;
}

interface CreateAuthenticatedUserOptions extends Partial<TestUser> {
  existingUser?: boolean;
}

export async function createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
  const prisma = getPrismaClient();
  const timestamp = Date.now();

  const defaultUser = {
    email: `user${timestamp}@test.com`,
    userName: `user${timestamp}`,
    name: `Test User ${timestamp}`,
    passwordHash: await argon2.hash('Password123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    }),
    role: Role.MEMBER,
    authProvider: AuthProvider.LOCAL,
    isVerified: true,
    ...overrides,
  };

  const user = await prisma.user.create({
    data: defaultUser,
  });

  return user as TestUser;
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
  rememberMe = false,
): Promise<string> {
  const httpServer = app.getHttpServer() as Server;
  const response = await request(httpServer)
    .post('/v1/auth/signin')
    .send({ email, password, rememberMe })
    .expect(200);

  const setCookieHeader = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  if (cookies.length === 0) {
    throw new Error('No authentication cookie received');
  }

  return extractAuthCookie(cookies);
}

export function extractAuthCookie(cookies: string[]): string {
  const authCookie = cookies.find((cookie: string) => cookie.startsWith('sprinttacker-session='));

  if (!authCookie) {
    throw new Error('Authentication cookie not found');
  }

  return authCookie.split(';')[0];
}

export async function createAuthenticatedUser(
  app: INestApplication,
  options?: CreateAuthenticatedUserOptions,
): Promise<{ user: TestUser; authCookie: string }> {
  const password = 'Password123!';

  if (options?.existingUser && options.email) {
    const prisma = getPrismaClient();
    const existingUser = await prisma.user.findUnique({
      where: { email: options.email },
    });

    if (existingUser) {
      const authCookie = await loginUser(app, existingUser.email, password);
      return { user: existingUser as TestUser, authCookie };
    }
  }

  const overrides: Partial<TestUser> = options
    ? {
        email: options.email,
        userName: options.userName,
        name: options.name,
        passwordHash: options.passwordHash,
        role: options.role,
        authProvider: options.authProvider,
        isVerified: options.isVerified,
      }
    : {};

  // Remove undefined values
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<TestUser>;

  const user = await createTestUser({
    passwordHash: await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    }),
    ...cleanOverrides,
  });

  const authCookie = await loginUser(app, user.email, password);

  return { user, authCookie };
}
