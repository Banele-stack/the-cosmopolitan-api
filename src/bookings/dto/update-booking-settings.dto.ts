import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ScheduleDto {
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

export class UpdateBookingSettingsDto {
  @IsOptional()
  @IsBoolean()
  bookingsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;
}
