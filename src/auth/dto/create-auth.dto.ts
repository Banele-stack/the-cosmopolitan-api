import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

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

  // Facebook, LinkedIn, or any other profile link — entirely optional. Can
  // be a personal profile or a business/ad page, if that's what the owner
  // wants shown on their listings.
  @IsOptional()
  @IsUrl(
    { require_protocol: false },
    { message: "Social link must be a valid URL." },
  )
  socialLink?: string;

  // Kept as its own field rather than folded into socialLink — a lot of
  // owners run both a Facebook presence and a TikTok one, and forcing a
  // choice between the two at signup meant one always got left out.
  @IsOptional()
  @IsUrl(
    { require_protocol: false },
    { message: "TikTok link must be a valid URL." },
  )
  tiktokUrl?: string;
}