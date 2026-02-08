import { Server } from 'http';

import { INestApplication } from '@nestjs/common';
import { Response } from 'supertest';

export interface TestResponse<T = unknown> extends Response {
  body: T;
}

export interface AuthSuccessResponse {
  message: string;
}

export interface BoardResponse {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  visibility: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
  };
}

export interface BoardMemberResponse {
  boardId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    userName: string;
    name: string;
  };
}

export interface ErrorResponse {
  message: string;
  error?: string;
  statusCode: number;
}

export interface MessageResponse {
  message: string;
}

export interface InviteResponse {
  id: string;
  boardId: string;
  senderId: string;
  recipientId: string;
  email: string;
  statusInvite: string;
  role: string;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  typeNotification: string;
  isRead: boolean;
  inviteId: string | null;
  invite?: InviteResponse | null;
}

export function getCookiesFromResponse(response: Response): string[] {
  const cookies = response.headers['set-cookie'];
  if (Array.isArray(cookies)) {
    return cookies;
  }
  return [];
}

/**
 * Returns a typed HTTP server from a NestJS application for use with supertest.
 * This function provides proper typing to avoid `any` type issues.
 */
export function getHttpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
