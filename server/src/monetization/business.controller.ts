import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { BusinessService } from './business.service';
import { RegisterBusinessDto, SponsorshipCheckoutDto } from './dto/business.dto';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businesses: BusinessService) {}

  @Public()
  @Get('sponsored-venues')
  sponsoredVenues() {
    return this.businesses.sponsoredVenues();
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterBusinessDto) {
    return this.businesses.register(dto);
  }

  // Public: a business registers (above) and pays without a user account.
  @Public()
  @Post(':id/sponsorship-checkout')
  sponsorshipCheckout(@Param('id') id: string, @Body() dto: SponsorshipCheckoutDto) {
    return this.businesses.createSponsorshipCheckout(id, dto.tier);
  }
}
