import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateMeDto } from './dto/update-user.dto';
import { lookingForIn, meUser, publicUser, userPublicInclude } from '../common/serializers/user.serializer';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geocoding: GeocodingService,
    private readonly notifications: NotificationsService,
  ) {}

  async publicProfile(id: string): Promise<unknown> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userPublicInclude });
    if (!user) throw new NotFoundException('User not found.');
    const counts = await this.counts(id);
    return { ...publicUser(user), ...counts };
  }

  async me(id: string): Promise<unknown> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: userPublicInclude });
    return meUser(user);
  }

  private async counts(id: string): Promise<{ hostedCount: number; attendedCount: number }> {
    const [hostedCount, attendedCount] = await Promise.all([
      this.prisma.event.count({ where: { hostId: id } }),
      this.prisma.attendance.count({ where: { userId: id } }),
    ]);
    return { hostedCount, attendedCount };
  }

  /** Submit a selfie (with the prompted pose) for identity verification → admin review. */
  async submitVerification(id: string, selfie: Express.Multer.File | undefined, pose?: string): Promise<unknown> {
    if (!selfie) throw new BadRequestException('A verification selfie is required.');
    // Validated by file signature + re-encoded (EXIF/GPS stripped) in StorageService.
    const selfieUrl = await this.storage.saveImage(selfie, 'verify');
    const previous = await this.prisma.user.findUnique({ where: { id }, select: { verificationSelfieUrl: true } });
    await this.prisma.user.update({
      where: { id },
      data: {
        verificationSelfieUrl: selfieUrl,
        verificationPose: pose ?? null,
        verificationStatus: 'PENDING',
      },
    });
    // A re-submission replaces the old selfie — don't keep identity photos around.
    if (previous?.verificationSelfieUrl && previous.verificationSelfieUrl !== selfieUrl) {
      await this.storage.delete(previous.verificationSelfieUrl);
    }
    await this.notifications.notifyAdmins(
      { type: 'admin', title: 'New verification to review', body: 'A user submitted an identity selfie for verification.' },
      id,
    );
    return this.me(id);
  }

  async updateMe(id: string, dto: UpdateMeDto, photo?: Express.Multer.File): Promise<unknown> {
    const photoUrl = photo ? await this.storage.saveImage(photo, 'avatar') : undefined;
    const oldPhoto = photoUrl
      ? (await this.prisma.user.findUnique({ where: { id }, select: { photoUrl: true } }))?.photoUrl
      : undefined;
    const coords = dto.zip || dto.neighborhood ? this.geocoding.geocode(dto.zip, dto.neighborhood) : null;

    await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        bio: dto.bio,
        neighborhood: dto.neighborhood,
        zip: dto.zip,
        phone: dto.phone,
        lookingFor: lookingForIn(dto.lookingFor),
        locale: dto.locale,
        ...(dto.emailNotifications !== undefined ? { emailNotifications: dto.emailNotifications } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      },
    });
    // Replaced avatar → remove the old file (ignored if it isn't one of ours).
    if (oldPhoto && oldPhoto !== photoUrl) await this.storage.delete(oldPhoto);
    return this.me(id);
  }
}
