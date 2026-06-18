import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessMemberRole } from '@prisma/client';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessRoles } from '../common/decorators/business-roles.decorator';
import { BusinessRoleGuard } from '../common/guards/business-role.guard';
import { BusinessOrgService } from './business-org.service';
import {
  AcceptInviteDto,
  CreateBusinessDto,
  InviteMemberDto,
  SubmitVerificationDto,
  UpdateBusinessOrgDto,
  UpdateMemberRoleDto,
} from './dto/business-org.dto';

@ApiTags('business-org')
@Controller()
export class BusinessOrgController {
  constructor(private readonly businesses: BusinessOrgService) {}

  @ApiBearerAuth()
  @Post('businesses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('me/businesses')
  mine(@CurrentUser() user: AuthUser) {
    return this.businesses.myBusinesses(user.id);
  }

  // Invitee accepts — no business id in the path, so authorize by membership only.
  @ApiBearerAuth()
  @Post('businesses/members/accept')
  acceptInvite(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.businesses.acceptInvite(user.id, dto);
  }

  @OptionalAuth()
  @Get('businesses/:id')
  profile(@Param('id') id: string) {
    return this.businesses.publicProfile(id);
  }

  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.MANAGER)
  @UseGuards(BusinessRoleGuard)
  @Patch('businesses/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessOrgDto) {
    return this.businesses.update(id, dto);
  }

  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.OWNER)
  @UseGuards(BusinessRoleGuard)
  @Post('businesses/:id/verification')
  @UseInterceptors(FilesInterceptor('documents', 6, { limits: { fileSize: 8 * 1024 * 1024 } }))
  submitVerification(
    @Param('id') id: string,
    @Body() dto: SubmitVerificationDto,
    @UploadedFiles() documents?: Express.Multer.File[],
  ) {
    return this.businesses.submitVerification(id, dto, documents ?? []);
  }

  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.OWNER)
  @UseGuards(BusinessRoleGuard)
  @Post('businesses/:id/members/invite')
  invite(@Param('id') id: string, @Body() dto: InviteMemberDto) {
    return this.businesses.invite(id, dto);
  }

  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.OWNER)
  @UseGuards(BusinessRoleGuard)
  @Patch('businesses/:id/members/:userId')
  updateMemberRole(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateMemberRoleDto) {
    return this.businesses.updateMemberRole(id, userId, dto);
  }

  @ApiBearerAuth()
  @BusinessRoles(BusinessMemberRole.OWNER)
  @UseGuards(BusinessRoleGuard)
  @Delete('businesses/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.businesses.removeMember(id, userId);
  }
}
