import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { VerificationCode } from "./entities/verificationCode.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { sendSms } from "./helpers/clickatell.helper";
import { sendVerificationEmail } from "./helpers/email.helper";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
     @InjectRepository(VerificationCode)
  private verificationRepository: Repository<VerificationCode>,
  ) {}

  private async createVerificationCode(
  userId: number,
  type: "email" | "phone",
) {
  const user = await this.usersService.findOne(userId);

  if (!user) {
    throw new UnauthorizedException();
  }

  // Remove any previous code of the same type
  await this.verificationRepository.delete({
    user: { id: userId },
    type,
  });

  const code = Math.floor(
    100000 + Math.random() * 900000,
  ).toString();

  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000, // 10 minutes
  );

  const verification =
    this.verificationRepository.create({
      user,
      code,
      type,
      expiresAt,
    });

  await this.verificationRepository.save(
    verification,
  );

  return code;
}

  // =========================
  // SIGNUP
  // =========================
async signup(dto: {
  firstName: string;
  surname: string;
  email?: string;
  phoneNumber?: string;
  password: string;
}) {
  if (!dto.email && !dto.phoneNumber) {
    throw new BadRequestException(
      "Either email or phone number is required.",
    );
  }

  if (dto.phoneNumber) {
    const existingUser = await this.usersService.findByPhone(
      dto.phoneNumber,
    );

    if (existingUser) {
      throw new BadRequestException(
        "Phone number is already registered.",
      );
    }
  }

  if (dto.email) {
    const existingUser = await this.usersService.findByEmail(
      dto.email,
    );

    if (existingUser) {
      throw new BadRequestException(
        "Email is already registered.",
      );
    }
  }

  const passwordHash = await bcrypt.hash(dto.password, 10);

  const user = await this.usersService.create({
    firstName: dto.firstName,
    surname: dto.surname,
    email: dto.email,
    phoneNumber: dto.phoneNumber,
    password: passwordHash,
  });

  const token = this.jwtService.sign({
    sub: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
  });

  return {
    message: "User created successfully",
    access_token: token,
    user,
  };
}

  // =========================
  // LOGIN
  // =========================
async login(dto: {
  identifier: string;
  password: string;
}) {
  const user = dto.identifier.includes("@")
    ? await this.usersService.findByEmail(dto.identifier)
    : await this.usersService.findByPhone(dto.identifier);

  if (!user) {
    throw new UnauthorizedException("Invalid credentials");
  }

  const isValid = await bcrypt.compare(
    dto.password,
    user.passwordHash,
  );

  if (!isValid) {
    throw new UnauthorizedException("Invalid credentials");
  }

  const payload = {
  sub: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
};

const token = this.jwtService.sign(payload);

  return {
    access_token: token,
    user,
  };
}

  // =========================
  // OPTIONAL: validate user (for guards later)
  // =========================
  async validateUser(userId: number) {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }


  // =========================
// EMAIL VERIFICATION
// =========================

async sendEmailVerification(userId: number) {
  const user = await this.usersService.findOne(userId);

  if (!user) {
    throw new UnauthorizedException();
  }

  if (!user.email) {
    throw new BadRequestException(
      "No email address found.",
    );
  }

  const code = await this.createVerificationCode(
    userId,
    "email",
  );

await sendVerificationEmail(user.email, code);

return {
  message: "Verification code sent successfully.",
};
}

// =========================
// PHONE VERIFICATION
// =========================

async sendPhoneVerification(userId: number) {
  const user = await this.usersService.findOne(userId);

  if (!user) {
    throw new UnauthorizedException();
  }

  if (!user.phoneNumber) {
    throw new BadRequestException(
      "No phone number found.",
    );
  }

  const code = await this.createVerificationCode(
    userId,
    "phone",
  );

await sendSms(user.phoneNumber, code);

return {
  message: "Verification code sent successfully.",
};

}

async verifyEmail(
  userId: number,
  code: string,
) {
  const verification =
    await this.verificationRepository.findOne({
      where: {
        user: { id: userId },
        type: "email",
        code,
      },
      relations: {
  user: true,
},
    });

  if (!verification) {
    throw new BadRequestException(
      "Invalid verification code.",
    );
  }

  if (verification.expiresAt < new Date()) {
    throw new BadRequestException(
      "Verification code has expired.",
    );
  }

  verification.user.emailVerified = true;

  await this.usersService.save(verification.user);

  await this.verificationRepository.delete(
    verification.id,
  );

  return {
    message: "Email verified successfully.",
  };
}

async verifyPhone(
  userId: number,
  code: string,
) {
  const verification =
    await this.verificationRepository.findOne({
      where: {
        user: { id: userId },
        type: "phone",
        code,
      },
          relations: {
  user: true,
},
    });

  if (!verification) {
    throw new BadRequestException(
      "Invalid verification code.",
    );
  }

  if (verification.expiresAt < new Date()) {
    throw new BadRequestException(
      "Verification code has expired.",
    );
  }

  verification.user.phoneVerified = true;

  await this.usersService.save(verification.user);

  await this.verificationRepository.delete(
    verification.id,
  );

  return {
    message: "Phone verified successfully.",
  };
}

}