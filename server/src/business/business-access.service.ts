import { ForbiddenException, Injectable } from '@nestjs/common';
import { BusinessMemberRole, BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// OWNER ⊇ MANAGER ⊇ STAFF — a higher rank satisfies a lower minimum requirement.
const RANK: Record<BusinessMemberRole, number> = {
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
};

/**
 * Central authority for "is this user an active member of this business, with a
 * sufficient role". Shared by BusinessRoleGuard (param/body-based routes) and by
 * services that resolve the business from a related entity (e.g. a venue).
 */
@Injectable()
export class BusinessAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The caller's active role in the business, or null if not an active member. */
  async memberRole(userId: string, businessId: string): Promise<BusinessMemberRole | null> {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!member || member.status !== BusinessMemberStatus.ACTIVE) return null;
    return member.role;
  }

  /** Throw 403 unless the caller is an active member with at least `min` role. */
  async assertRole(userId: string, businessId: string, min: BusinessMemberRole): Promise<BusinessMemberRole> {
    const role = await this.memberRole(userId, businessId);
    if (!role || RANK[role] < RANK[min]) {
      throw new ForbiddenException('You do not have permission to manage this business.');
    }
    return role;
  }
}
