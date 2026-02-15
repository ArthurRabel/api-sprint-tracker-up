import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';

import { BoardGateway } from './board.gateway';
import { BoardListener } from './listeners/board.listener';
import { NotificationListener } from './listeners/notification.listener';
import { NotificationsGateway } from './notification.gateway';

@Module({
  providers: [NotificationsGateway, BoardGateway, BoardListener, NotificationListener],
  imports: [PrismaModule, AuthModule.register()],
})
export class EventsModule {}
