import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { MailService } from '../mail/mail.service';
import { ReferralService } from '../referral/referral.service';
import { TokensService, TokenPair } from './tokens.service';
import { AuthTokensService, EMAIL_VERIFY_TTL_MS, PASSWORD_RESET_TTL_MS } from './auth-tokens.service';
import { BusinessSignupDto, ForgotPasswordDto, LoginDto, ResetPasswordDto, SignupDto } from './dto/auth.dto';
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
    private readonly referral: ReferralService,
    private readonly authTokens: AuthTokensService,
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
        locale: dto.locale,
        status: 'ACTIVE', // active immediately — no approval gating
        // emailVerifiedAt stays null until the emailed link is used.
      },
    });

    // Credit the referral (grants both users Pro trial days) before we serialize
    // the response, so the new user immediately sees their Pro perk. Best-effort.
    await this.referral.applyOnSignup(user.id, dto.referralCode);

    // Welcome + verification emails (fire-and-forget — never block signup on email delivery).
    void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);
    void this.sendVerification(user).catch(() => undefined);

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
        locale: dto.locale,
      },
    });

    void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);
    void this.sendVerification(user).catch(() => undefined);

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
          // Google has already verified ownership of this address.
          emailVerifiedAt: new Date(),
        },
      });
      void this.mail.sendWelcome({ email: user.email, name: user.name }).catch(() => undefined);
    } else if (!user.googleId || !user.emailVerifiedAt) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
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

  // ---- Password reset ------------------------------------------------------

  /**
   * Always resolves with the same generic body, whether or not the account
   * exists (no account enumeration). Beyond the per-IP route throttle, each
   * account gets at most RESET_MAX_PER_WINDOW reset emails per window.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true; message: string }> {
    const generic = {
      success: true as const,
      message: 'If an account exists for that email, we’ve sent a link to reset the password.',
    };
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user || user.status === 'BANNED') return generic;

    const recent = await this.authTokens.countRecent(user.id, 'PASSWORD_RESET', EMAIL_WINDOW_MS);
    if (recent >= EMAIL_MAX_PER_WINDOW) return generic;

    const token = await this.authTokens.issue(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MS);
    void this.mail
      .sendPasswordReset({ email: user.email, name: user.name, locale: dto.locale ?? user.locale }, token, !!user.passwordHash)
      .catch(() => undefined);
    return generic;
  }

  /**
   * Consume a reset token and set a new password. Also works for Google-only
   * accounts (no password yet). Revokes every refresh token so all sessions are
   * signed out, and — since the user proved inbox access — marks the email verified.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const invalid = () =>
      new BadRequestException({ message: 'This reset link is invalid or has expired.', code: 'INVALID_TOKEN' });
    const userId = await this.authTokens.consume(dto.token, 'PASSWORD_RESET');
    if (!userId) throw invalid();
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.status === 'BANNED') throw invalid();

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
    await this.authTokens.revokeAll(userId, 'PASSWORD_RESET');
    void this.mail.sendPasswordChanged({ email: user.email, name: user.name, locale: user.locale }).catch(() => undefined);
    return { success: true };
  }

  // ---- Email verification ---------------------------------------------------

  private async sendVerification(user: { id: string; email: string; name: string; locale?: string | null }): Promise<void> {
    const token = await this.authTokens.issue(user.id, 'EMAIL_VERIFY', EMAIL_VERIFY_TTL_MS);
    await this.mail.sendEmailVerification({ email: user.email, name: user.name, locale: user.locale }, token);
  }

  async verifyEmail(token: string): Promise<{ success: true }> {
    const userId = await this.authTokens.consume(token, 'EMAIL_VERIFY');
    if (!userId) {
      throw new BadRequestException({ message: 'This verification link is invalid or has expired.', code: 'INVALID_TOKEN' });
    }
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    return { success: true };
  }

  async resendVerification(userId: string): Promise<{ success: true; alreadyVerified: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { success: true, alreadyVerified: true };
    const recent = await this.authTokens.countRecent(user.id, 'EMAIL_VERIFY', EMAIL_WINDOW_MS);
    if (recent >= EMAIL_MAX_PER_WINDOW) {
      throw new HttpException(
        { message: 'Too many verification emails. Please wait a few minutes and try again.', code: 'TOO_MANY_REQUESTS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.sendVerification(user);
    return { success: true, alreadyVerified: false };
  }
}

/** Per-account cap on reset/verification emails (on top of the per-IP route throttle). */
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 3;
