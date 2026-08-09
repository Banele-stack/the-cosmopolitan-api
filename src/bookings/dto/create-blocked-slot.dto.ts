import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateBlockedSlotDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
