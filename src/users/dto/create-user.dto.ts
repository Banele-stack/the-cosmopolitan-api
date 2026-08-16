export class CreateUserDto {
  firstName: string;
  surname: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  socialLink?: string;
  tiktokUrl?: string;
}