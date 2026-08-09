import { IsString, MinLength } from "class-validator";

export class LoginAuthDto {
  @IsString()
  identifier: string;

  @IsString()
  @MinLength(6)
  password: string;
}