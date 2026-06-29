import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { ReferralModule } from '../referral/referral.module';

// Only register the Google strategy when credentials are present.
const googleProvider: Provider = {
  provide: 'GOOGLE_STRATEGY',
  inject: [ConfigService],
  useFactory: (config: ConfigService) => (config.get('google.enabled') ? new GoogleStrategy(config) : null),
};

@Module({
  imports: [JwtModule.register({}), ReferralModule],
  controllers: [AuthController],
  providers: [AuthService, TokensService, JwtStrategy, googleProvider],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
