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

  @IsNumber()
  bathrooms: number;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsDateString()
  availableFrom: Date;

  @IsNumber()
  deposit: number;

  @IsString()
  leaseTerm: string;

  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities: AmenitiesDto;

  @IsOptional()
  images?: string[];

  @IsOptional()
  videos?: string[];
}