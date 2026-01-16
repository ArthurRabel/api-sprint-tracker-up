import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UserInfoDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty({ message: 'Id cannot be empty' })
  @IsNumber({}, { message: 'Id must be a number' })
  id: number;

  @ApiProperty({ example: 'first name last name' })
  @IsNotEmpty({ message: 'Fill in the full name field' })
  @IsString({ message: 'Name must be a string' })
  fullName: string;

  @ApiProperty({ example: 'username' })
  @IsNotEmpty({ message: 'Fill in the username field' })
  @IsString({ message: 'Name must be a string' })
  userName: string;

  @ApiProperty({ example: 'example@gmail.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;
}
