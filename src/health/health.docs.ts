import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

export function GetHealthDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Check service health',
      description: 'Verifies if the service is running correctly.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Service is healthy',
    }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}
