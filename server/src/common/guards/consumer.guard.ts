import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Blocks BUSINESS-role accounts from consumer-only, person-centric actions
 * (joining activities, rating people, identity verification). Business accounts
 * can still host activities at their venue — only participation is denied.
 *
 * Apply with `@UseGuards(ConsumerGuard)` on the specific handlers/controllers
 * that represent consumer behaviour. Runs after the global JwtAuthGuard, so a
 * user is present on protected routes.
 */
@Injectable()
export class ConsumerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.role === 'BUSINESS') {
      throw new ForbiddenException('Business accounts can’t use this feature.');
    }
    return true;
  }
}
