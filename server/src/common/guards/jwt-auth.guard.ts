import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

/**
 * Global JWT guard. Skips fully-public routes, and on optional-auth routes it
 * attaches the user when a token is present but never rejects.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    return super.canActivate(context);
  }

  // For optional-auth, swallow auth errors and continue as anonymous.
  handleRequest<TUser = unknown>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional) {
      return (user ?? undefined) as TUser;
    }
    return super.handleRequest(err, user, _info, context);
  }
}
