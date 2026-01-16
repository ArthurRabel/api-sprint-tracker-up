import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

export function importFromTrelloDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upload de arquivo único' }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary'
          }
        }
      }
    })
  )
}