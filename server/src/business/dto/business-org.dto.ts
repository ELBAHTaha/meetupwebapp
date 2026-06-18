import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { BusinessMemberRole } from '@prisma/client';

export class CreateBusinessDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @MaxLength(240)
  address!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  website?: string;

  // Separate Business ToS / advertising-policy acceptance gate (§12).
  @IsBoolean()
  acceptBusinessTos!: boolean;
}

export class UpdateBusinessOrgDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(160) legalName?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(240) website?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) coverUrl?: string;
}

export class SubmitVerificationDto {
  @IsOptional() @IsString() @MaxLength(60) rcNumber?: string;
  @IsOptional() @IsString() @MaxLength(60) iceNumber?: string;

  // Already-hosted document URLs (in addition to any uploaded files).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(BusinessMemberRole)
  role!: BusinessMemberRole;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(BusinessMemberRole)
  role!: BusinessMemberRole;
}
