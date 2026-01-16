import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class ResponseInviteBoardDto {
  @ApiProperty({
    example: '12345',
    description: 'ID of the invite to respond to',
  })
  @IsNotEmpty({ message: 'Invite ID cannot be empty' })
  idInvite: string;

  @ApiProperty({
    example: 'true',
    description: 'Response to the invite, true to accept and false to decline',
  })
  @IsBoolean({ message: 'Response must be a boolean value' })
  response: boolean;
}
