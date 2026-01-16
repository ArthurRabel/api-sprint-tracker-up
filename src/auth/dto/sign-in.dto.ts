import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'username@gmail.com' })
  @IsEmail({}, { message: 'Must be in email format' })
  @IsNotEmpty({ message: 'Fill in with your email' })
  @IsString({ message: 'Email must be a string' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Fill in with your password' })
  @IsString({ message: 'Password must be a string' })
  password: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'Must be a boolean' })
  rememberMe: boolean;
}
