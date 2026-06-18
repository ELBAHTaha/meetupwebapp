import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessMemberRole } from '@prisma/client';
import { BUSINESS_ROLES_KEY } from '../decorators/business-roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { BusinessAccessService } from '../../business/business-access.service';

/**
 * Guards business-management routes. The required role from @BusinessRoles is
 * treated as a minimum (OWNER ⊇ MANAGER ⊇ STAFF). The business id is resolved
 * from params (`id`/`businessId`) or the body (`businessId`) — so it fits org
 * routes (`/businesses/:id/...`) and venue-create (businessId in body). Routes
 * where `:id` is NOT the business (e.g. `PATCH /venues/:id`) authorize in-service.
 */
@Injectable()
export class BusinessRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: BusinessAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BusinessMemberRole[]>(BUSINESS_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const min = required?.[0] ?? BusinessMemberRole.STAFF;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new UnauthorizedException();

    const businessId: string | undefined = req.params?.id ?? req.params?.businessId ?? req.body?.businessId;
    if (!businessId) throw new ForbiddenException('No business context.');

    await this.access.assertRole(user.id, businessId, min);
    return true;
  }
}
