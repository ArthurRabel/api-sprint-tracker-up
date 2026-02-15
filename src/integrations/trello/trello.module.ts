import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AwsS3Module } from '@/infrastructure/awsS3/awsS3.module';
import { ListModule } from '@/list/list.module';
import { TaskModule } from '@/task/task.module';

import { TrelloProcessor } from './processors/trello.processor';
import { TrelloController } from './trello.controller';
import { TrelloService } from './trello.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'import-queue',
    }),
    ListModule,
    TaskModule,
    AwsS3Module,
  ],
  controllers: [TrelloController],
  providers: [TrelloService, TrelloProcessor],
})
export class TrelloModule {}
