import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class updateProfileDto {
  @ApiProperty({ example: 'first name last name' })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Matches(/^[A-Za-zÀ-ÿ\s]+$/, {
    message: 'Name must contain only letters and spaces',
  })
  name: string;

  @ApiProperty({ example: 'username' })
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @Matches(/.*[a-zA-Z].*/, {
    message: 'Username must contain at least one letter',
  })
  userName: string;

  @ApiProperty({ example: 'example@gmail.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  @IsOptional()
  email: string;
}
