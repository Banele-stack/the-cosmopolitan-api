import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";


import { Auth } from "./entities/auth.entity";

import { UsersModule } from "src/users/users.module";
import { JwtStrategy } from "./jwt.strategy";
import { VerificationCode } from "./entities/verificationCode.entity";
// import { ClickatellService } from "src/common/sms/clickatell.service";

@Module({
  imports: [
    UsersModule,

    TypeOrmModule.forFeature([Auth, VerificationCode]),

    // 🔐 JWT MODULE (MISSING BEFORE)
    JwtModule.register({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: "7d" },
}),

    // 🔐 PASSPORT MODULE (REQUIRED for JwtAuthGuard)
    PassportModule,

    // Rate limiting, scoped to this module's controller only (see
    // @UseGuards(ThrottlerGuard) on AuthController) — signup/login/OTP
    // endpoints are the realistic brute-force/spam targets, not browsing
    // or listing-creation endpoints.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy, // 🔥 REQUIRED
  ],
})
export class AuthModule {}