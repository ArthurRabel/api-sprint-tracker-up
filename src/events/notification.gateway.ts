import { WebSocketGateway } from '@nestjs/websockets';

import { BaseGateway } from './base.gateway';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway extends BaseGateway {
  public sendNewNotificationToUser(userId: string): boolean {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized!');
      return false;
    }

    const room = this.server.sockets.adapter.rooms.get(userId);
    if (!room || room.size === 0) {
      this.logger.warn(`No clients connected in room ${userId}`);
      return false;
    }

    this.server.to(userId).emit('newNotification');
    this.logger.log(`Event 'newNotification' emitted to user: ${userId}`);

    return true;
  }
}
