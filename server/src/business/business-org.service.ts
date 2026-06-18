import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Business, BusinessMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessAccessService } from './business-access.service';
import {
  AcceptInviteDto,
  CreateBusinessDto,
  InviteMemberDto,
  SubmitVerificationDto,
  UpdateBusinessOrgDto,
  UpdateMemberRoleDto,
} from './dto/business-org.dto';

type UploadFile = { buffer: Buffer; originalname: string; mimetype: string };

@Injectable()
export class BusinessOrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly access: BusinessAccessService,
  ) {}

  /** Create a business; the caller becomes its OWNER. Status PENDING_VERIFICATION. */
  async create(userId: string, dto: CreateBusinessDto) {
    if (!dto.acceptBusinessTos) {
      throw new BadRequestException('You must accept the business terms of service.');
    }
    const { acceptBusinessTos: _accept, ...data } = dto;
    const business = await this.prisma.business.create({
      data: {
        ...data,
        ownerId: userId,
        status: 'PENDING_VERIFICATION',
        businessTosAcceptedAt: new Date(),
        members: { create: { userId, role: 'OWNER', status: 'ACTIVE' } },
      },
    });
    await this.notifications.notifyAdmins(
      { type: 'admin', title: 'New business registered', body: `“${business.name}” registered and is awaiting verification.` },
      userId,
    );
    return this.serialize(business, BusinessMemberRole.OWNER);
  }

  /** Businesses the caller belongs to (for business-mode context switching). */
  async myBusinesses(userId: string) {
    const memberships = await this.prisma.businessMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { business: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => this.serialize(m.business, m.role));
  }

  /** Public business profile: name, logo, category, venues, verified badge. */
  async publicProfile(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        venues: { where: { status: { not: 'LISTED' } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!business || business.status === 'SUSPENDED') throw new NotFoundException('Business not found.');
    return {
      id: business.id,
      name: business.name,
      category: business.category,
      description: business.description ?? '',
      logoUrl: business.logoUrl ?? null,
      coverUrl: business.coverUrl ?? null,
      website: business.website ?? null,
      verified: business.status === 'VERIFIED',
      venues: business.venues.map((v) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        category: v.category,
        address: v.address,
        avgRating: Number(v.avgRating),
        reviewCount: v.reviewCount,
        photos: (v.photos as string[] | null) ?? [],
      })),
    };
  }

  async update(id: string, dto: UpdateBusinessOrgDto) {
    await this.ensureBusiness(id);
    const business = await this.prisma.business.update({ where: { id }, data: { ...dto } });
    const role = BusinessMemberRole.MANAGER; // caller passed the guard
    return this.serialize(business, role);
  }

  /** Submit RC/ICE + documents for admin review. Status returns to PENDING_VERIFICATION. */
  async submitVerification(id: string, dto: SubmitVerificationDto, files: UploadFile[] = []) {
    await this.ensureBusiness(id);
    const uploaded = await Promise.all(
      (files ?? []).filter((f) => f.mimetype).map((f) => this.storage.save(f, 'biz-doc')),
    );
    const documentUrls = [...(dto.documentUrls ?? []), ...uploaded];
    const verification = await this.prisma.businessVerification.create({
      data: {
        businessId: id,
        rcNumber: dto.rcNumber,
        iceNumber: dto.iceNumber,
        documentUrls,
        status: 'PENDING',
      },
    });
    await this.prisma.business.update({
      where: { id },
      data: {
        rcNumber: dto.rcNumber ?? undefined,
        iceNumber: dto.iceNumber ?? undefined,
        status: 'PENDING_VERIFICATION',
      },
    });
    await this.notifications.notifyAdmins({
      type: 'admin',
      title: 'Business verification submitted',
      body: 'A business submitted RC/ICE documents for verification review.',
    });
    return { id: verification.id, status: verification.status.toLowerCase(), documentCount: documentUrls.length };
  }

  // --- Members ------------------------------------------------------------

  /** Invite an existing user (by email) to the business with a role. */
  async invite(businessId: string, dto: InviteMemberDto) {
    await this.ensureBusiness(businessId);
    if (dto.role === 'OWNER') throw new BadRequestException('Cannot invite another OWNER.');
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('That email has no account yet — ask them to sign up first.');

    const existing = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
    });
    if (existing) throw new BadRequestException('That user is already a member or invited.');

    await this.prisma.businessMember.create({
      data: { businessId, userId: user.id, role: dto.role, invitedEmail: dto.email, status: 'INVITED' },
    });
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    await this.notifications.push({
      userId: user.id,
      type: 'admin',
      title: 'You were invited to a business',
      body: `You’ve been invited to join “${business?.name}” as ${dto.role.toLowerCase()}.`,
    });
    return { success: true };
  }

  /** Invitee accepts their pending invitation. */
  async acceptInvite(userId: string, dto: AcceptInviteDto) {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: dto.businessId, userId } },
    });
    if (!member) throw new NotFoundException('No invitation found.');
    if (member.status === 'ACTIVE') return { success: true };
    await this.prisma.businessMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    });
    return { success: true };
  }

  async updateMemberRole(businessId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found.');
    if (member.role === 'OWNER') throw new ForbiddenException('Cannot change the OWNER’s role.');
    if (dto.role === 'OWNER') throw new BadRequestException('Use ownership transfer to assign OWNER.');
    await this.prisma.businessMember.update({ where: { id: member.id }, data: { role: dto.role } });
    return { success: true };
  }

  async removeMember(businessId: string, targetUserId: string) {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found.');
    if (member.role === 'OWNER') throw new ForbiddenException('Cannot remove the OWNER.');
    await this.prisma.businessMember.delete({ where: { id: member.id } });
    return { success: true };
  }

  // --- helpers ------------------------------------------------------------

  private async ensureBusiness(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  private serialize(business: Business, role: BusinessMemberRole) {
    return {
      id: business.id,
      name: business.name,
      category: business.category,
      legalName: business.legalName ?? undefined,
      rcNumber: business.rcNumber ?? undefined,
      iceNumber: business.iceNumber ?? undefined,
      description: business.description ?? '',
      address: business.address,
      lat: business.lat ?? undefined,
      lng: business.lng ?? undefined,
      contactEmail: business.contactEmail,
      phone: business.phone ?? '',
      website: business.website ?? undefined,
      logoUrl: business.logoUrl ?? null,
      coverUrl: business.coverUrl ?? null,
      status: business.status.toLowerCase(),
      verified: business.status === 'VERIFIED',
      role: role.toLowerCase(),
    };
  }
}
