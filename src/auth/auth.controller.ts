import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe, Req } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { CreateAuthDto } from "./dto/create-auth.dto";
import { LoginAuthDto } from "./dto/login-auth.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

// Without this, LoginAuthDto/CreateAuthDto's class-validator decorators are
// never enforced — e.g. a malformed login body 500s instead of 400ing,
// since dto.identifier is just undefined rather than rejected up front.
// Same gap as RoomController had; Business/Gig/Room controllers already do this.
@Controller("auth")
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

@Post("signup")
signup(@Body() dto: CreateAuthDto) {
  return this.authService.signup(dto);
}

@Post("login")
login(@Body() dto: LoginAuthDto) {
  return this.authService.login(dto);
}

  @UseGuards(JwtAuthGuard)
  @Post("send-email-verification")
  sendEmailVerification(@Req() req) {
    return this.authService.sendEmailVerification(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post("send-phone-verification")
  sendPhoneVerification(@Req() req) {
    return this.authService.sendPhoneVerification(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
@Post("verify-email")
verifyEmail(
  @Req() req,
  @Body() body: { code: string },
) {
  return this.authService.verifyEmail(
    req.user.sub,
    body.code,
  );
}

@UseGuards(JwtAuthGuard)
@Post("verify-phone")
verifyPhone(
  @Req() req,
  @Body() body: { code: string },
) {
  return this.authService.verifyPhone(
    req.user.sub,
    body.code,
  );
}
}