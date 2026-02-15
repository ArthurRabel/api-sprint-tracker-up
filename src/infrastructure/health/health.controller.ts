import { Controller, Get } from '@nestjs/common';

import { GetHealthDocs } from './health.docs';
import { HealthService } from './health.service';

@Controller('health-check')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @GetHealthDocs()
  @Get()
  getHealth() {
    return this.healthService.getStatus();
  }
}
