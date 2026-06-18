import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { MailService } from '../mail/mail.service';
import { TokensService, TokenPair } from './tokens.service';
import { BusinessSignupDto, LoginDto, SignupDto } from './dto/auth.dto';
import { age } from '../common/utils/private-place';
import { lookingForIn, meUser, userPublicInclude } from '../common/serializers/user.serializer';
import { GoogleProfile } from './strategies/google.strategy';

/** Stable hash for banned-contact lookups (normalized). */
export function hashContact(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly storage: StorageService,
    private readonly geocoding: GeocodingService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private async withUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userPublicInclude });
  }

  /** Verify a Cloudflare Turnstile token. Dev bypass when no real secret is set. */
  private async verifyTurnstile(token?: string): Promise<void> {
    const secret = this.config.get<string>('turnstile.secretKey');
    if (!secret || secret.includes('xxx')) return; // not configured → bypass
    if (!token) throw new BadRequestException('Please complete the CAPTCHA.');
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) throw new BadRequestException('CAPTCHA verification failed. Please try again.');
  }

  /** Block re-registration with a banned user's phone/email. */
  private async assertNotBanned(email: string, phone?: string): Promise<void> {
    const hashes = [hashContact(email), ...(phone ? [hashContact(phone)] : [])];
    const hit = await this.prisma.bannedContact.findFirst({
      where: { OR: [{ emailHash: { in: hashes } }, { phoneHash: { in: hashes } }] },
      select: { id: true },
    });
    if (hit) throw new ForbiddenException('This account can’t be created.');
  }

  async signup(dto: SignupDto, photo?: Express.Multer.File): Promise<{ user: unknown } & TokenPair> {
    await this.verifyTurnstile(dto.turnstileToken);
    const birthday = new Date(dto.birthday);
    if (Number.isNaN(birthday.getTime())) throw new BadRequestException('Invalid birthday.');
    if (age(birthday) < 18) throw new UnprocessableEntityException('You must be 18 or older to use hudlgo.');

    await this.assertNotBanned(dto.email, dto.phone);
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

    // Welcome email (fire-and-forget — never block signup on email delivery).
    void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);

    const pair = await this.tokens.issue(user);
    return { user: meUser(await this.withUser(user.id)), ...pair };
  }

  /**
   * Sign up a venue/business account (role BUSINESS). Business accounts are
   * separate from consumer accounts — an email already used by any account is
   * rejected so a personal user can't be turned into a business.
   */
  async signupBusiness(dto: BusinessSignupDto): Promise<{ user: unknown } & TokenPair> {
    await this.verifyTurnstile(dto.turnstileToken);
    await this.assertNotBanned(dto.email, dto.phone);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException(
        'An account with this email already exists. Use a different email for your business account.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        phone: dto.phone,
        role: 'BUSINESS',
        status: 'ACTIVE',
      },
    });

    void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);

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
      void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);
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
