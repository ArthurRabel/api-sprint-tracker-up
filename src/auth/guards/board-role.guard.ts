import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { BOARD_ROLES_KEY } from '@/auth/strategy/decorators/board-rules.decorator';
import { PrismaService } from '@/prisma/prisma.service';

import type { Request } from 'express';

interface ParamsWithOptionalIds {
  boardId?: string;
  listId?: string;
  taskId?: string;
  id?: string;
  [key: string]: string | undefined;
}

interface ReqBody {
  boardId?: string;
  listId?: string;
  [key: string]: unknown;
}

interface AuthenticatedRequest extends Request<ParamsWithOptionalIds, unknown, ReqBody> {
  user?: { id?: string };
}

@Injectable()
export class BoardRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(BOARD_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user?.id) throw new ForbiddenException('User not authenticated');

    const boardId = await this.resolveBoardId(req);
    if (!boardId) {
      throw new ForbiddenException('Action not allowed');
    }

    const membership = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this board.');
    }

    const isAllowed = requiredRoles.includes(membership.role);
    if (!isAllowed) {
      throw new ForbiddenException('Action not allowed for your role on this board.');
    }

    return true;
  }

  private async resolveBoardId(req: AuthenticatedRequest): Promise<string | null> {
    if (req.params?.boardId) return req.params.boardId;

    if (req.body?.boardId) return req.body.boardId;

    const tryResolveByListId = async (listId: string | undefined) => {
      if (!listId) return null;
      const list = await this.prisma.list.findUnique({
        where: { id: listId },
        select: { boardId: true },
      });
      return list?.boardId ?? null;
    };

    const byParamList = await tryResolveByListId(req.params?.listId);
    if (byParamList) return byParamList;

    const byBodyList = await tryResolveByListId(req.body?.listId);
    if (byBodyList) return byBodyList;

    const tryResolveByTaskId = async (taskId: string | undefined) => {
      if (!taskId) return null;
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { list: { select: { boardId: true } } },
      });
      return task?.list?.boardId ?? null;
    };

    const byParamIdAsTask = await tryResolveByTaskId(req.params?.id);
    if (byParamIdAsTask) return byParamIdAsTask;

    const byParamTask = await tryResolveByTaskId(req.params?.taskId);
    if (byParamTask) return byParamTask;

    return null;
  }
}
