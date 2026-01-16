import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { BoardRoleGuard } from '@/auth/guards/board-role.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { BoardRoles } from '@/auth/strategy/decorators/board-rules.decorator';

import { GetCompletedTasksSummaryDocs, GetBasicSummaryDocs } from './analysis.docs';
import { AnalysisService } from './analysis.service';
import { GetCompletedSummaryDto } from './dto/get-completed-summary.dto';

@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'analysis', version: '1' })
export class AnalysisController {
  constructor(private readonly AnalysisService: AnalysisService) {}

  @GetCompletedTasksSummaryDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  @Get('completed/:boardId')
  async getCompletedTasksSummary(
    @Param('boardId') boardId: string,
    @Query() query: GetCompletedSummaryDto,
  ) {
    return await this.AnalysisService.getCompletedTasksSummary(boardId, query);
  }

  @GetBasicSummaryDocs()
  @UseGuards(JwtAuthGuard, BoardRoleGuard)
  @BoardRoles(Role.ADMIN, Role.MEMBER, Role.OBSERVER)
  @Get(':boardId')
  async getBasicSummary(@Param('boardId') boardId: string) {
    return await this.AnalysisService.getBasicSummary(boardId);
  }
}
