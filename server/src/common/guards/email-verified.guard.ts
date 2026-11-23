import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../decorators/current-user.decorator';

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/**
 * Blocks accounts that haven't confirmed their email from creating/hosting or
 * joining activities and from sending chat messages. Browsing and logging in
 * stay open. Responds 403 with `code: "EMAIL_NOT_VERIFIED"` so the frontend can
 * show its verify prompt. Runs after the global JwtAuthGuard.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user && !user.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Please verify your email address first — check your inbox for the confirmation link.',
        code: EMAIL_NOT_VERIFIED,
      });
    }
    return true;
  }
}
