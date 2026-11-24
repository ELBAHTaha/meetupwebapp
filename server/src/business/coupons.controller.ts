import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BusinessMemberRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { BusinessRoles } from '../common/decorators/business-roles.decorator';
import { BusinessRoleGuard } from '../common/guards/business-role.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CouponsService } from './coupons.service';

class RedeemCouponDto {
  @IsString()
  @MaxLength(40)
  code!: string;
}

/** Coupon checks/redemption at the venue — any active staff member (STAFF+) or the owner. */
@ApiTags('coupons')
@ApiBearerAuth()
@BusinessRoles(BusinessMemberRole.STAFF)
@UseGuards(BusinessRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('businesses/:id/coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /** Preview a code before redeeming it (activity, attendee, validity). */
  @Get('lookup')
  async lookup(@Param('id') id: string, @Query('code') code = '') {
    const { activityVenueId: _internal, ...check } = await this.coupons.lookup(id, code);
    return check;
  }

  @Post('redeem')
  redeem(@Param('id') id: string, @Body() dto: RedeemCouponDto, @CurrentUser() user: AuthUser) {
    return this.coupons.redeem(id, dto.code, user.id);
  }
}
