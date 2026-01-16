import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class MoveTaskOtherListDto {
  @ApiProperty({
    description: 'ID of the list where the task will be moved',
    example: '1234567890abcdef12345678',
  })
  @IsString()
  newListId: string;

  @ApiProperty({
    description: 'Position of the task in the list',
    example: 1,
  })
  @IsNumber()
  newPosition: number;
}
