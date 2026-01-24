import {
  Controller,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';

import { importFromTrelloDocs } from './imports.docs';
import { ImportsService } from './imports.service';
import { JsonFileValidator } from './validators/json-file.validator';

@Throttle({
  short: { limit: 2, ttl: 1000 },
  long: { limit: 2, ttl: 60000 },
})
@ApiCookieAuth()
@ApiTags('Imports')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @importFromTrelloDocs()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('trello/:boardId')
  async importFromTrello(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new JsonFileValidator())
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    await this.importsService.importFromTrello(user.id, boardId, file);

    return 'Import started';
  }
}
