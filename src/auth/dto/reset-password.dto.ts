import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword, MinLength } from 'class-validator';

import { Match } from '@/common/utils/match.decorator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'StrongP@ssword123' })
  @IsString({ message: 'New password must be a string.' })
  @IsNotEmpty({ message: 'New password cannot be empty.' })
  @MinLength(8, { message: 'New password must be at least 8 characters long.' })
  @IsStrongPassword(
    {},
    {
      message:
        'New password must be at least 8 characters long, including 1 uppercase letter, 1 number, and 1 special character.',
    },
  )
  newPassword: string;

  @ApiProperty({ example: 'StrongP@ssword123' })
  @IsString({ message: 'Password confirmation must be a string.' })
  @IsNotEmpty({ message: 'Password confirmation cannot be empty.' })
  @MinLength(8, {
    message: 'Password confirmation must be at least 8 characters long.',
  })
  @Match('newPassword', {
    message: 'Passwords do not match.',
  })
  confirmNewPassword: string;
}
