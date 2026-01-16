import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

import { Match } from '@/common/utils/match.decorator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Password cannot be omitted' })
  @IsString({ message: 'Password must be a string' })
  oldPassword: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'New password cannot be omitted' })
  @IsString({ message: 'New password must be a string' })
  @IsStrongPassword(
    {},
    {
      message:
        'New password must be at least 8 characters long, including 1 uppercase letter, 1 number, and 1 special character.',
    },
  )
  newPassword: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Password confirmation cannot be omitted' })
  @IsString({ message: 'Password confirmation must be a string' })
  @IsStrongPassword(
    {},
    {
      message:
        'Password confirmation must be at least 8 characters long, including 1 uppercase letter, 1 number, and 1 special character.',
    },
  )
  @Match('newPassword', {
    message: 'Passwords do not match.',
  })
  confirmNewPassword: string;
}
