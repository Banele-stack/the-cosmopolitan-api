import { IsDateString, IsOptional, IsString, IsNotEmpty } from "class-validator";

export class CreateBookingDto {
  @IsDateString()
  date: string;

  // "HH:MM" — must match one of the currently open slots returned by
  // GET .../availability, re-validated server-side at booking time.
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
