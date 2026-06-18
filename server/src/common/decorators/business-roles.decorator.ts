import { SetMetadata } from '@nestjs/common';
import { BusinessMemberRole } from '@prisma/client';

export const BUSINESS_ROLES_KEY = 'businessRoles';

/**
 * Minimum business-member role required for a route. The role hierarchy is
 * OWNER ⊇ MANAGER ⊇ STAFF, so passing MANAGER also admits OWNER. Used with
 * BusinessRoleGuard on routes where the business id is in params (`id`/
 * `businessId`) or the request body (`businessId`).
 */
export const BusinessRoles = (...roles: BusinessMemberRole[]) => SetMetadata(BUSINESS_ROLES_KEY, roles);
