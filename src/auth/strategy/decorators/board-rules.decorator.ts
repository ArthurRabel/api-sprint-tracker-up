import { SetMetadata } from '@nestjs/common';

import { Role } from '@/board/types/board.types';

export const BOARD_ROLES_KEY = 'board_roles';
export const BoardRoles = (...roles: Role[]) => SetMetadata(BOARD_ROLES_KEY, roles);
