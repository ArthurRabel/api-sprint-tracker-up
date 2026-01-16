import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { ImportsProcessor } from './processors/imports.processor';
import { StorageService } from '@/storage/storage.service';
import { BullModule } from '@nestjs/bullmq';
import { ListModule } from '@/list/list.module';
import { StorageModule } from '@/storage/storage.module';
import { TaskModule } from '@/task/task.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'import-queue',
    }),
    ListModule,
    TaskModule,
    StorageModule
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportsProcessor
  ],
})
export class ImportsModule { }
