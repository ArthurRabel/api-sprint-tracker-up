import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateAuthTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsNotEmpty({ message: 'Access token cannot be empty' })
  @IsString({ message: 'Access token must be a string' })
  accessToken: string;

  @ApiProperty({ example: '3600' })
  @IsNotEmpty({ message: 'Expiration time cannot be empty' })
  @IsString({ message: 'Expiration time must be a string' })
  expiresIn: string;

  @ApiProperty({ example: new Date().toISOString() })
  @IsNotEmpty({ message: 'Creation date cannot be empty' })
  createdAt: string;
}
