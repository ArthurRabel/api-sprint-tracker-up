import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

enum RoleUserBoard {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  OBSERVER = 'OBSERVER',
}

export class InviteBoardDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Username of the user to invite',
  })
  @IsNotEmpty({ message: 'Username cannot be empty' })
  userName: string;

  @ApiProperty({
    example: 'OBSERVER',
    description: 'User permission on the board. Can be ADMIN, MEMBER or OBSERVER',
    enum: RoleUserBoard,
  })
  @IsOptional()
  @IsEnum(RoleUserBoard)
  role: RoleUserBoard;
}
