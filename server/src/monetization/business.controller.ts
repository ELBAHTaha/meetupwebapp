import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessService } from './business.service';
import { RegisterBusinessDto, RemovePhotoDto, SponsorshipCheckoutDto, UpdateBusinessDto } from './dto/business.dto';

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

  @ApiBearerAuth()
  @Post('mine/photos')
  @UseInterceptors(FilesInterceptor('photos', 6, { limits: { fileSize: 5 * 1024 * 1024 } }))
  addPhotos(@CurrentUser() user: AuthUser, @UploadedFiles() photos: Express.Multer.File[]) {
    return this.businesses.addPhotos(user.id, photos ?? []);
  }

  @ApiBearerAuth()
  @Delete('mine/photos')
  removePhoto(@CurrentUser() user: AuthUser, @Body() dto: RemovePhotoDto) {
    return this.businesses.removePhoto(user.id, dto.url);
  }

  // Public so a business can register while signing up. The owner just created a
  // dedicated business account (role BUSINESS) — link the venue to it. A personal
  // user account can't own a business; they must sign up a separate one.
  @OptionalAuth()
  @Post('register')
  register(@Body() dto: RegisterBusinessDto, @CurrentUser() user?: AuthUser) {
    if (user && user.role !== 'BUSINESS') {
      throw new ForbiddenException('Personal accounts can’t own a business. Sign up a separate business account.');
    }
    return this.businesses.register(dto, user?.id);
  }

  // Public: a business registers (above) and pays without a user account.
  @Public()
  @Post(':id/sponsorship-checkout')
  sponsorshipCheckout(@Param('id') id: string, @Body() dto: SponsorshipCheckoutDto) {
    return this.businesses.createSponsorshipCheckout(id, dto.tier);
  }
}
