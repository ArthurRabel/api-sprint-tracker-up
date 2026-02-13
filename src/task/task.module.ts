import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';

import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

@Module({
  providers: [TaskService, TaskRepository],
  controllers: [TaskController],
  imports: [PrismaModule],
  exports: [TaskService],
})
export class TaskModule {}
