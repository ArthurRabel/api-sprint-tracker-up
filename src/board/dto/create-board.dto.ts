import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { BoardVisibility } from '@/common/enums/board-visibility.enum';

export class CreateBoardDto {
  @ApiProperty({
    example: 'My First Board',
    description: 'Board title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'This is an example board',
    description: 'Optional board description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'PRIVATE',
    description: 'Board visibility',
    enum: BoardVisibility,
    required: false,
  })
  @IsOptional()
  @IsEnum(BoardVisibility)
  visibility?: BoardVisibility;
}
