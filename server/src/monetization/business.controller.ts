import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessService } from './business.service';
import { RegisterBusinessDto, SponsorshipCheckoutDto, UpdateBusinessDto } from './dto/business.dto';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businesses: BusinessService) {}

  @Public()
  @Get('sponsored-venues')
  sponsoredVenues() {
    return this.businesses.sponsoredVenues();
  }

  // The signed-in owner's venue dashboard data.
  @ApiBearerAuth()
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.businesses.myBusiness(user.id);
  }

  @ApiBearerAuth()
  @Patch('mine')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateBusinessDto) {
    return this.businesses.updateMyBusiness(user.id, dto);
  }

  // Public so a business can register while signing up. If a user is signed in
  // (the owner just created their account), link the venue to them.
  @OptionalAuth()
  @Post('register')
  register(@Body() dto: RegisterBusinessDto, @CurrentUser() user?: AuthUser) {
    return this.businesses.register(dto, user?.id);
  }

  // Public: a business registers (above) and pays without a user account.
  @Public()
  @Post(':id/sponsorship-checkout')
  sponsorshipCheckout(@Param('id') id: string, @Body() dto: SponsorshipCheckoutDto) {
    return this.businesses.createSponsorshipCheckout(id, dto.tier);
  }
}
