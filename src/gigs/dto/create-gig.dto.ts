import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class GigLocationDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  area: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CreateGigDto {
  @IsIn(["need_help", "offering_work"])
  type: "need_help" | "offering_work";

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategorySlug?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsIn(["fixed", "hourly", "negotiable"])
  priceType?: "fixed" | "hourly" | "negotiable";

  @IsIn(["today", "this_week", "flexible"])
  urgency: "today" | "this_week" | "flexible";

  @ValidateNested()
  @Type(() => GigLocationDto)
  @IsObject()
  location: GigLocationDto;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;
}
