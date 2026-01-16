import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    example: '12345678-l',
    description: 'Verification code for password reset',
  })
  @IsNotEmpty({ message: 'Verification code cannot be empty.' })
  @IsString({ message: 'Verification code must be a string.' })
  code: string;
}
