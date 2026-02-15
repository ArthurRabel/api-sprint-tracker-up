import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as cookie from 'cookie';
import { Server, Socket } from 'socket.io';

import { AuthService } from '@/auth/auth.service';
import { User } from '@/common/interfaces';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export abstract class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly socketData = new WeakMap<Socket, { user?: { id: string; name?: string } }>();

  constructor(private readonly authService: AuthService) {}
  logger = new Logger(`WebSocketGateway ${this.constructor.name}`);

  protected getClientUser(client: Socket): { id: string; name?: string } | undefined {
    return this.socketData.get(client)?.user;
  }

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie || '');
      const token: string | undefined = cookies['sprinttacker-session'];

      if (!token) {
        throw new Error('Session token missing');
      }
      const user: User | null = await this.authService.validateUserFromToken(token);

      if (!user) {
        throw new Error('User not authenticated');
      }

      const safeUser: { id: string; name?: string } = {
        id: user.id,
        name: user.name ?? undefined,
      };
      this.socketData.set(client, { user: safeUser });

      await client.join(safeUser.id);

      this.logger.log(`Client connected: ${client.id}, User: ${safeUser.name ?? 'Unknown'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('WebSocket authentication failed:', message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketData.get(client);
    const userName = meta?.user?.name ?? 'Unknown';
    this.logger.log(`Client disconnected: ${client.id}, User: ${userName}`);
  }
}
