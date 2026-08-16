import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { UpdateProfileDto } from "./dto/update-profile.dto";


@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

@UseGuards(JwtAuthGuard)
@Get("profile")
async getProfile(@Req() req) {
  console.log("req.user:", req.user);

  const user = await this.usersService.findOne(req.user.sub);

  return {
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    socialLink: user.socialLink,
    tiktokUrl: user.tiktokUrl,
    role: user.role,
    createdAt: user.createdAt,
  };
}

@UseGuards(JwtAuthGuard)
@Get("onboarding-status")
getOnboardingStatus(@Req() req: any) {
  return this.usersService.getOnboardingStatus(req.user.sub);
}

@UseGuards(JwtAuthGuard)
@Patch("profile")
async updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
  const user = await this.usersService.update(req.user.sub, {
    firstName: dto.firstName?.trim() || undefined,
    surname: dto.surname?.trim() || undefined,
    socialLink: dto.socialLink?.trim() || undefined,
    tiktokUrl: dto.tiktokUrl?.trim() || undefined,
  });

  return {
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    socialLink: user.socialLink,
    tiktokUrl: user.tiktokUrl,
    role: user.role,
    createdAt: user.createdAt,
  };
}
}