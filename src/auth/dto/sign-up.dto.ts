import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'first name last name' })
  @IsNotEmpty({ message: 'Fill in the full name field' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @ApiProperty({ example: 'username' })
  @IsNotEmpty({ message: 'Fill in the username field' })
  @IsString({ message: 'Name must be a string' })
  userName: string;

  @ApiProperty({ example: 'username@gmail.com' })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Fill in the email field.' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Fill in the password field' })
  @IsStrongPassword(
    {},
    {
      message:
        'Password must be 8 characters long, 1 special character, 1 number, and 1 uppercase letter',
    },
  )
  password: string;
}
