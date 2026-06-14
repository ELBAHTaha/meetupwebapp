import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string;
}

/**
 * Registered conditionally — only when GOOGLE_CLIENT_ID/SECRET are present
 * (see AuthModule). Uses dummy creds otherwise to avoid constructor throws,
 * but the routes are guarded so it's never reachable when disabled.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('google.clientId') ?? 'disabled',
      clientSecret: config.get<string>('google.clientSecret') ?? 'disabled',
      callbackURL: config.get<string>('google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value ?? '';
    const result: GoogleProfile = {
      googleId: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      photoUrl: profile.photos?.[0]?.value,
    };
    done(null, result);
  }
}
