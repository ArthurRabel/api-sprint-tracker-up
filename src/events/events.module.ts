import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

import { BoardGateway } from './board.gateway';
import { BoardListener } from './board.listener';
import { NotificationsGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';

@Module({
  providers: [NotificationsGateway, BoardGateway, BoardListener, NotificationListener],
  imports: [PrismaModule, AuthModule.register()],
})
export class EventsModule {}
