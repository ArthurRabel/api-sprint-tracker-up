import { DynamicModule, Module, Type } from '@nestjs/common';

import { TrelloModule } from './trello/trello.module';

function getIntegrationsImports(): Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> {
  const dbInMemoryEnabled = process.env.ENABLE_DATABASE_IN_MEMORY === 'true';

  const baseImports: Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> = [];

  if (dbInMemoryEnabled) {
    baseImports.push(TrelloModule);
  }

  return baseImports;
}

@Module({
  imports: getIntegrationsImports(),
})
export class IntegrationsModule {}
