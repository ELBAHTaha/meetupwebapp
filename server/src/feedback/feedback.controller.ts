import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  // Anyone can send feedback; if signed in, attach the author for context.
  @OptionalAuth()
  @Post()
  submit(@Body() dto: CreateFeedbackDto, @CurrentUser() user?: AuthUser) {
    return this.feedback.create(dto, user?.id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list() {
    return this.feedback.list();
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.feedback.resolve(id);
  }
}
