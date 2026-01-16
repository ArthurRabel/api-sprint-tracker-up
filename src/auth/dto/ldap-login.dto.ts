import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LdapLoginDto {
  @ApiProperty({
    example: '20210001',
    description: 'User enrollment (registration number)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username cannot be empty.' })
  enrollment: string;

  @ApiProperty({
    example: 'your_secure_password',
    description: 'User password',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;
}
