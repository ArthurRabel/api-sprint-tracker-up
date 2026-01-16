import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdatePositionDto {
  @ApiProperty({
    description: 'Position of the task in the list',
    example: 1,
  })
  @IsNumber()
  newPosition: number;
}
