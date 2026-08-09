import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  IsNumber,
  IsIn,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class OperatingHoursDto {
  @IsOptional()
  @IsString()
  monday?: string;

  @IsOptional()
  @IsString()
  tuesday?: string;

  @IsOptional()
  @IsString()
  wednesday?: string;

  @IsOptional()
  @IsString()
  thursday?: string;

  @IsOptional()
  @IsString()
  friday?: string;

  @IsOptional()
  @IsString()
  saturday?: string;

  @IsOptional()
  @IsString()
  sunday?: string;
}

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Self-declared trust signal, e.g. "BCom Accounting Graduate" — see
  // Business entity for why this exists and isn't verified.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  credential?: string;

  @IsString()
  @IsNotEmpty()
  categorySlug: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategorySlug?: string;

  @IsIn(['physical', 'online'])
  businessType: 'physical' | 'online';

  @IsString()
  @IsNotEmpty()
  description: string;

  // Required fields inside location depend on businessType — a physical
  // business needs a full address+coordinates, an online one doesn't need
  // any of it. Enforced in BusinessService.create/update rather than here,
  // since class-validator's nested @ValidateIf can't see the parent DTO's
  // businessType from within LocationDto's own field decorators.
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  @IsObject()
  location?: LocationDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  @IsObject()
  operatingHours?: OperatingHoursDto;

  @IsOptional()
  @IsBoolean()
  supportsDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsWhatsAppOrder?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  whatsappNumber?: string;

  // The number the listing's "Call" button dials. Required so every new
  // listing is actually reachable — see Business entity for why this
  // column is nullable despite that (pre-existing rows have none yet).
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsOptional()
  @IsIn(['$', '$$', '$$$', '$$$$'])
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
}
