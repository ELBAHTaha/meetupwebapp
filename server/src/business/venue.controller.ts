import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessMemberRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessRoles } from '../common/decorators/business-roles.decorator';
import { BusinessRoleGuard } from '../common/guards/business-role.guard';
import { VenueService } from './venue.service';
import {
  ClaimVenueDto,
  CreateVenueDto,
  CreateVenueReviewDto,
  UpdateVenueDto,
  VenueQueryDto,
} from './dto/venue.dto';

@ApiTags('venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venues: VenueService) {}

  @Public()
  @Get()
  list(@Query() query: VenueQueryDto) {
    return this.venues.list(query);
  }

  @Public()
  @Get(':id')
  profile(@Param('id') id: string) {
    return this.venues.profile(id);
  }

  // businessId is in the body → BusinessRoleGuard resolves it (no conflicting :id).
  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.MANAGER)
  @UseGuards(BusinessRoleGuard)
  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }

  // `:id` is the venue, not the business → authorize in-service.
  @ApiBearerAuth()
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venues.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @Post(':id/claim')
  @UseInterceptors(FilesInterceptor('evidence', 6, { limits: { fileSize: 8 * 1024 * 1024 } }))
  claim(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ClaimVenueDto,
    @UploadedFiles() evidence?: Express.Multer.File[],
  ) {
    return this.venues.claim(user.id, id, dto, evidence ?? []);
  }

  @ApiBearerAuth()
  @Post(':id/reviews')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateVenueReviewDto) {
    return this.venues.addReview(user.id, id, dto);
  }
}
