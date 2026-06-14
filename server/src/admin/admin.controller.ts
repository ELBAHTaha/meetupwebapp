import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ModerateNoteDto, SuspendDto } from './dto/moderate.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('flagged-users')
  flagged() {
    return this.admin.flaggedUsers();
  }

  @Get('reports')
  reports() {
    return this.admin.reports();
  }

  @Get('subscribers')
  subscribers() {
    return this.admin.subscribers();
  }

  @Get('businesses')
  businesses() {
    return this.admin.businessesList();
  }

  @Post('businesses/:id/approve')
  approveBusiness(@Param('id') id: string) {
    return this.admin.approveBusiness(id);
  }

  @Get('express-payments')
  expressPayments() {
    return this.admin.expressPaymentsList();
  }

  @Get('pending-activities')
  pendingActivities() {
    return this.admin.pendingActivities();
  }

  @Post('activities/:id/approve')
  approveActivity(@Param('id') id: string) {
    return this.admin.approveActivity(id);
  }

  @Post('activities/:id/reject')
  rejectActivity(@Param('id') id: string) {
    return this.admin.rejectActivity(id);
  }

  @Get('under-review')
  underReview() {
    return this.admin.underReviewActivities();
  }

  @Post('activities/:id/restore')
  restoreActivity(@Param('id') id: string) {
    return this.admin.restoreActivity(id);
  }

  @Patch('reports/:id/resolve')
  resolve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.resolveReport(id, user.id);
  }

  @Post('users/:id/warn')
  warn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateNoteDto) {
    return this.admin.warn(user.id, id, dto.note);
  }

  @Post('users/:id/suspend')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SuspendDto) {
    return this.admin.suspend(user.id, id, dto.days ?? 7, dto.note);
  }

  @Post('users/:id/ban')
  ban(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateNoteDto) {
    return this.admin.ban(user.id, id, dto.note);
  }
}
