import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpgradesService } from './upgrades.service';
import {
  AdminPlanDto,
  AdminSponsorshipDto,
  ApproveUpgradeDto,
  CreateUpgradeRequestDto,
  RejectUpgradeDto,
} from './dto/upgrade.dto';

/** Customer side: request a plan, see payment instructions, cancel. */
@ApiTags('upgrades')
@ApiBearerAuth()
@Controller('upgrades')
export class UpgradesController {
  constructor(private readonly upgrades: UpgradesService) {}

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUpgradeRequestDto) {
    return this.upgrades.create(user.id, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.upgrades.mine(user.id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.upgrades.cancel(user.id, id);
  }
}

/** Admin side: review requests and grant/extend/revoke plans directly. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminUpgradesController {
  constructor(private readonly upgrades: UpgradesService) {}

  @Get('upgrade-requests')
  list(@Query('status') status?: string) {
    return this.upgrades.adminList(status);
  }

  @Post('upgrade-requests/:id/approve')
  approve(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ApproveUpgradeDto) {
    return this.upgrades.approve(admin.id, id, dto);
  }

  @Post('upgrade-requests/:id/reject')
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectUpgradeDto) {
    return this.upgrades.reject(admin.id, id, dto.adminNote);
  }

  @Get('users/search')
  search(@Query('q') q = '') {
    return this.upgrades.adminSearchUsers(q);
  }

  @Post('users/:id/plan')
  setUserPlan(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdminPlanDto) {
    return this.upgrades.adminSetUserPlan(admin.id, id, dto);
  }

  @Post('businesses/:id/sponsorship')
  setSponsorship(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdminSponsorshipDto) {
    return this.upgrades.adminSetSponsorship(admin.id, id, dto);
  }
}
