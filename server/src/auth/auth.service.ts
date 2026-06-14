import { BadRequestException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { TokensService, TokenPair } from './tokens.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { age } from '../common/utils/private-place';
import { lookingForIn, meUser, userPublicInclude } from '../common/serializers/user.serializer';
import { GoogleProfile } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly storage: StorageService,
    private readonly geocoding: GeocodingService,
  ) {}

  private async withUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userPublicInclude });
  }

  async signup(dto: SignupDto, photo?: Express.Multer.File): Promise<{ user: unknown } & TokenPair> {
    const birthday = new Date(dto.birthday);
    if (Number.isNaN(birthday.getTime())) throw new BadRequestException('Invalid birthday.');
    if (age(birthday) < 18) throw new UnprocessableEntityException('You must be 18 or older to use Jmaâ.');

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('An account with this email already exists.');

    const photoUrl = photo ? await this.storage.save(photo, 'avatar') : undefined;
    const coords = this.geocoding.geocode(dto.zip, dto.neighborhood);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        photoUrl,
        neighborhood: dto.neighborhood,
        zip: dto.zip,
        lat: coords?.lat,
        lng: coords?.lng,
        birthday,
        gender: dto.gender,
        phone: dto.phone,
        lookingFor: lookingForIn(dto.lookingFor) ?? 'BOTH',
        status: 'ACTIVE', // active immediately — no approval gating
      },
    });

    const pair = await this.tokens.issue(user);
    return { user: meUser(await this.withUser(user.id)), ...pair };
  }

  async login(dto: LoginDto): Promise<{ user: unknown } & TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid email or password.');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password.');
    if (user.status === 'BANNED') throw new UnauthorizedException('Your account is banned.');

    const pair = await this.tokens.issue(user);
    return { user: meUser(await this.withUser(user.id)), ...pair };
  }

  async googleLogin(profile: GoogleProfile): Promise<TokenPair> {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          name: profile.name,
          photoUrl: profile.photoUrl,
          status: 'ACTIVE',
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
    }
    return this.tokens.issue(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      return await this.tokens.rotate(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.revoke(refreshToken);
    return { success: true };
  }

  async me(userId: string): Promise<unknown> {
    return meUser(await this.withUser(userId));
  }
}
