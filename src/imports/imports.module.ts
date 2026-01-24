import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ListModule } from '@/list/list.module';
import { StorageModule } from '@/storage/storage.module';
import { TaskModule } from '@/task/task.module';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportsProcessor } from './processors/imports.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'import-queue',
    }),
    ListModule,
    TaskModule,
    StorageModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor],
})
export class ImportsModule {}
