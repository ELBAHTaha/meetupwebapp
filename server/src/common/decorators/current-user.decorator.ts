import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'BUSINESS';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  /** False until the user confirms their email (EmailVerifiedGuard). */
  emailVerified: boolean;
}

/** Injects the authenticated user (or undefined on optional-auth routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
