import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { ListService } from '@/list/list.service';

import { ListController } from './list.controller';
import { ListRepository } from './list.repository';

@Module({
  providers: [ListService, ListRepository],
  controllers: [ListController],
  imports: [PrismaModule],
  exports: [ListService],
})
export class ListModule {}
