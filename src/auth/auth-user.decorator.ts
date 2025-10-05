import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from './auth-user.interface';

export const AuthUser = createParamDecorator((data: unknown, ctx: ExecutionContext): RequestUser | null => {
  const request = ctx.switchToHttp().getRequest<Request & { authUser?: RequestUser }>();
  return request.authUser ?? null;
});
