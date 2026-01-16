import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateListDto {
  @ApiProperty({
    example: 'boardId123',
    description: 'ID of the board to which the list belongs',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @ApiProperty({
    example: 'To Do',
    description: 'List title',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 1,
    description: 'List position within the board',
    required: false,
  })
  @IsInt()
  @IsOptional()
  position?: number;

  @ApiProperty({
    example: false,
    description: 'Indicates if the list is archived',
    required: false,
  })
  @IsOptional()
  isArchived?: boolean;

  @ApiProperty({
    example: '123',
    description: 'ID of external system (e.g., Trello)',
    required: false,
  })
  @IsString()
  @IsOptional()
  externalId?: string;
}
