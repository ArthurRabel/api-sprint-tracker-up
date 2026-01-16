import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

import { GenerateAuthTokenDto } from './generate-auth-token.dto';
import { UserInfoDto } from './user-info.dto';

export class SignResponseJwtDto {
  @ApiProperty({ type: GenerateAuthTokenDto })
  @IsNotEmpty({ message: 'Access data cannot be empty' })
  access: GenerateAuthTokenDto;

  @ApiProperty({ type: UserInfoDto })
  @IsNotEmpty({ message: 'User data cannot be empty' })
  user: UserInfoDto;
}
