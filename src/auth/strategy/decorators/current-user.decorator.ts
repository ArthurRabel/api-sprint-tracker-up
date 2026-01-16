import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '@/common/interfaces/user.interface';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user;
});
