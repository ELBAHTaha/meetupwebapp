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

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
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

  @Get('business-verifications')
  businessVerifications() {
    return this.admin.businessVerifications();
  }

  @Post('business-verifications/:id/approve')
  approveBusinessVerification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.approveBusinessVerification(id, user.id);
  }

  @Post('business-verifications/:id/reject')
  rejectBusinessVerification(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateNoteDto) {
    return this.admin.rejectBusinessVerification(id, user.id, dto.note);
  }

  @Get('venue-claims')
  venueClaims() {
    return this.admin.venueClaims();
  }

  @Post('venue-claims/:id/approve')
  approveVenueClaim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.approveVenueClaim(id, user.id);
  }

  @Post('venue-claims/:id/reject')
  rejectVenueClaim(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateNoteDto) {
    return this.admin.rejectVenueClaim(id, user.id, dto.note);
  }

  @Post('venue-reviews/:id/flag')
  flagVenueReview(@Param('id') id: string) {
    return this.admin.flagVenueReview(id);
  }

  @Post('venue-reviews/:id/remove')
  removeVenueReview(@Param('id') id: string) {
    return this.admin.removeVenueReview(id);
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

  @Get('verifications')
  verifications() {
    return this.admin.pendingVerifications();
  }

  @Post('verifications/:id/approve')
  approveVerification(@Param('id') id: string) {
    return this.admin.approveVerification(id);
  }

  @Post('verifications/:id/reject')
  rejectVerification(@Param('id') id: string) {
    return this.admin.rejectVerification(id);
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
