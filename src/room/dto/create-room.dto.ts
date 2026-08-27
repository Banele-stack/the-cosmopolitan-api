import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class LocationDto {
  @IsString()
  address: string;

  @IsString()
  area: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

class AmenitiesDto {
  @IsBoolean()
  furnished: boolean;

  @IsBoolean()
  parking: boolean;

  @IsBoolean()
  wifi: boolean;

  @IsBoolean()
  electricityIncluded: boolean;

  @IsBoolean()
  waterIncluded: boolean;

  @IsBoolean()
  petsAllowed: boolean;
}

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsString()
  propertyType: string;

  @IsNumber()
  price: number;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  description: string;

  // The number the listing's "Call" button dials. Required so every new
  // listing is actually reachable.
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  whatsappNumber?: string;

  @IsNumber()
  bedrooms: number;

  // bathrooms/availableFrom/deposit/leaseTerm are optional — a real
  // listing sourced from a landlord's own published info doesn't always
  // state all of these. The frontend shows "Contact landlord for details"
  // rather than requiring the whole listing to wait on one missing field.
  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsDateString()
  availableFrom?: Date;

  @IsOptional()
  @IsNumber()
  deposit?: number;

  @IsOptional()
  @IsString()
  leaseTerm?: string;

  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities: AmenitiesDto;

  @IsOptional()
  images?: string[];

  @IsOptional()
  videos?: string[];
}