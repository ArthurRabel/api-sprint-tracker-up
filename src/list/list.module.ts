import { Module } from '@nestjs/common';

import { ListService } from '@/list/list.service';
import { PrismaModule } from '@/prisma/prisma.module';

import { ListController } from './list.controller';
import { ListRepository } from './list.repository';

@Module({
  providers: [ListService, ListRepository],
  controllers: [ListController],
  imports: [PrismaModule],
  exports: [ListService],
})
export class ListModule {}
