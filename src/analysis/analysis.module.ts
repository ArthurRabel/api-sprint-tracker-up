import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';

import { AnalysisController } from './analysis.controller';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [PrismaModule],
  providers: [AnalysisService, AnalysisRepository],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
