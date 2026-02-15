import { Module } from '@nestjs/common';

import { AnalysisModule } from '@/analysis/analysis.module';
import { AuthModule } from '@/auth/auth.module';
import { BoardModule } from '@/board/board.module';
import { InfrastructureModule } from '@/infrastructure/infrastructure.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { ListModule } from '@/list/list.module';
import { TaskModule } from '@/task/task.module';
import { UserModule } from '@/user/user.module';

import { AppController } from './app.controller';
import { CoreModule } from './core.module';

@Module({
  controllers: [AppController],
  imports: [
    CoreModule,
    InfrastructureModule,
    IntegrationsModule,
    AuthModule.register(),
    UserModule,
    BoardModule,
    ListModule,
    TaskModule,
    AnalysisModule,
  ],
})
export class AppModule {}
