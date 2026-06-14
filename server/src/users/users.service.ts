import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { UpdateMeDto } from './dto/update-user.dto';
import { lookingForIn, meUser, publicUser, userPublicInclude } from '../common/serializers/user.serializer';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geocoding: GeocodingService,
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

  async updateMe(id: string, dto: UpdateMeDto, photo?: Express.Multer.File): Promise<unknown> {
    const photoUrl = photo ? await this.storage.save(photo, 'avatar') : undefined;
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
        ...(photoUrl ? { photoUrl } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      },
    });
    return this.me(id);
  }
}
