import {
  Body,
  Controller,
  Delete,
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
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { BlocksService } from '../blocks/blocks.service';
import { ConsumerGuard } from '../common/guards/consumer.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly blocks: BlocksService,
  ) {}

  // ---- Blocking (declared before `:id` so "me" isn't read as a user id) ----
  @Get('me/blocks')
  myBlocks(@CurrentUser() user: AuthUser) {
    return this.blocks.listMine(user.id);
  }

  @Post(':id/block')
  block(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blocks.block(user.id, id);
  }

  @Delete(':id/block')
  unblock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blocks.unblock(user.id, id);
  }

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

  // Public, but a signed-in viewer can't see someone they blocked / who blocked them (404).
  @OptionalAuth()
  @Get(':id')
  publicProfile(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    return this.users.publicProfile(id, viewer?.id);
  }
}
