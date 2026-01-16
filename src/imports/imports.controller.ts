import { Controller, HttpStatus, Param, ParseFilePipeBuilder, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CreateBoardDocs } from '@/board/board.docs';
import { FileInterceptor } from '@nestjs/platform-express';
import { importFromTrelloDocs } from './imports.docs';
import { JsonFileValidator } from './validators/json-file.validator';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';

@ApiCookieAuth()
@ApiTags('Imports')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @CreateBoardDocs()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @importFromTrelloDocs()
  @Post('trello/:boardId')
  importFromTrello(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId') boardId: string,
    @UploadedFile(new ParseFilePipeBuilder()
      .addValidator(new JsonFileValidator())
      .addMaxSizeValidator({
        maxSize: 1024 * 1024 * 5
      })
      .build({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
      }),
  ) file: Express.Multer.File) {
    this.importsService.importFromTrello(
      user.id,
      boardId,
      file,
    );

    return "Import started";
  }
}
