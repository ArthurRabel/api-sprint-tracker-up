import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationsGateway } from '../notification.gateway';

interface NewNotificationPayload {
  userId: string;
}

@Injectable()
export class NotificationListener {
  constructor(private readonly notificationsGateway: NotificationsGateway) {}

  @OnEvent('notification.new')
  handleNewNotification(payload: NewNotificationPayload): void {
    this.notificationsGateway.sendNewNotificationToUser(payload.userId);
  }
}
