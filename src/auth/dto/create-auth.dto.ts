import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAuthDto {
  @IsString()
  firstName: string;

  @IsString()
  surname: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(6)
  password: string;
}