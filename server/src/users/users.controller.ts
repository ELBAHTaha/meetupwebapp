import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SubmitVerificationDto, UpdateMeDto } from './dto/update-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Public } from '../common/decorators/public.decorator';
import { ConsumerGuard } from '../common/guards/consumer.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('me/notifications')
  listNotifications(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Patch('me/notifications/read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch('me/notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('me')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto, @UploadedFile() photo?: Express.Multer.File) {
    return this.users.updateMe(user.id, dto, photo);
  }

  // Identity (selfie) verification is a consumer/dating feature — not for businesses.
  @Post('me/verification')
  @UseGuards(ConsumerGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 5 * 1024 * 1024 } }))
  submitVerification(@CurrentUser() user: AuthUser, @Body() dto: SubmitVerificationDto, @UploadedFile() selfie?: Express.Multer.File) {
    return this.users.submitVerification(user.id, selfie, dto.pose);
  }

  @Public()
  @Get(':id')
  publicProfile(@Param('id') id: string) {
    return this.users.publicProfile(id);
  }
}
