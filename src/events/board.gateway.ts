import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { AuthService } from '@/auth/auth.service';
import { PrismaService } from '@/prisma/prisma.service';

import { BaseGateway } from './base.gateway';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class BoardGateway extends BaseGateway {
  constructor(
    authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    super(authService);
  }

  private getBoardRoom(boardId: string) {
    return `board:${boardId}`;
  }

  @SubscribeMessage('joinBoard')
  public async joinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boardId: string },
  ) {
    const boardId = data?.boardId;
    if (!boardId) return { ok: false, reason: 'boardId required' };

    const userId: string | undefined = this.getClientUser(client)?.id;
    if (!userId) return { ok: false, reason: 'not authenticated' };

    const member = await this.prisma.boardMember.findFirst({
      where: { boardId, userId },
      select: { userId: true },
    });
    if (!member) return { ok: false, reason: 'no access to this board' };

    const room = this.getBoardRoom(boardId);
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { ok: true, room };
  }

  @SubscribeMessage('leaveBoard')
  public async leaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boardId: string },
  ) {
    const boardId = data?.boardId;
    if (!boardId) return { ok: false, reason: 'boardId required' };

    const room = this.getBoardRoom(boardId);
    await client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { ok: true, room };
  }

  public emitModifiedInBoard(
    boardId: string,
    payload: {
      boardId: string;
      action?: string;
      byUserId?: string;
      at?: string;
    },
  ): boolean {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized!');
      return false;
    }

    const room = this.getBoardRoom(boardId);
    const socketsRoom = this.server.sockets.adapter.rooms.get(room);
    if (!socketsRoom || socketsRoom.size === 0) {
      return false;
    }

    this.server.to(room).emit('boardModified', payload);
    this.logger.log(
      `Event 'boardModified' emitted to room: ${room} | boardId=${payload.boardId} action=${payload.action ?? 'updated'}`,
    );

    return true;
  }
}
