import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Role } from '../types/board.types';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, description: 'New member role' })
  @IsEnum(Role)
  role: Role;
}
