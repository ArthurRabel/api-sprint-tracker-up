import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/prisma/prisma.module';

import { BoardController } from './board.controller';
import { BoardRepository } from './board.repository';
import { BoardService } from './board.service';

@Module({
  providers: [BoardService, BoardRepository],
  controllers: [BoardController],
  imports: [PrismaModule],
  exports: [BoardService],
})
export class BoardModule {}
