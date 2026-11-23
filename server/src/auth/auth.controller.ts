import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  BusinessSignupDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { GoogleProfile } from './strategies/google.strategy';

const FIFTEEN_MIN = 15 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Public()
  @Post('signup')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  signup(@Body() dto: SignupDto, @UploadedFile() photo?: Express.Multer.File) {
    return this.auth.signup(dto, photo);
  }

  @Public()
  @Post('business/signup')
  signupBusiness(@Body() dto: BusinessSignupDto) {
    return this.auth.signupBusiness(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // ---- Password reset & email verification ----
  // Throttled hard per IP (the service also caps per account).
  @Public()
  @Throttle({ default: { limit: 3, ttl: FIFTEEN_MIN } })
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MIN } })
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: FIFTEEN_MIN } })
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: FIFTEEN_MIN } })
  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  // ---- Google OAuth (only functional when creds are configured) ----
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleStart(): void {
    if (!this.config.get('google.enabled')) throw new BadRequestException('Google sign-in is not configured.');
    // Passport redirects.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: { user: GoogleProfile }, @Res() res: Response): Promise<void> {
    const pair = await this.auth.googleLogin(req.user);
    const url = new URL('/auth/callback', this.config.get<string>('appUrl'));
    url.searchParams.set('accessToken', pair.accessToken);
    url.searchParams.set('refreshToken', pair.refreshToken);
    res.redirect(url.toString());
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
