import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { Room } from "src/room/entities/room.entity";
import { Business } from "src/business/entities/business.entity";

@Injectable()
export class UsersService {
  constructor(
  @InjectRepository(User)
  private readonly usersRepository: Repository<User>,

  @InjectRepository(Business)
  private readonly businessRepository: Repository<Business>,

  @InjectRepository(Room)
  private readonly roomRepository: Repository<Room>,
) {}

  async create(dto: CreateUserDto) {
  const user = this.usersRepository.create({
  firstName: dto.firstName,
  surname: dto.surname,
  email: dto.email,
  phoneNumber: dto.phoneNumber,
  passwordHash: dto.password,
  socialLink: dto.socialLink,
  tiktokUrl: dto.tiktokUrl,
});

  return this.usersRepository.save(user);
}

  findAll() {
    return this.usersRepository.find();
  }

  async getOnboardingStatus(userId: number) {
  const businessCount = await this.businessRepository.count({
    where: {
      owner: {
        id: userId,
      },
    },
  });

  const roomCount = await this.roomRepository.count({
    where: {
      owner: {
        id: userId,
      },
    },
  });

  return {
    hasBusiness: businessCount > 0,
    hasRoom: roomCount > 0,
    hasListings: businessCount > 0 || roomCount > 0,
  };
}

  findOne(id: number) {
    console.log("Looking for user:", id);
    return this.usersRepository.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdateProfileDto) {
    await this.usersRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.usersRepository.delete(id);
  }

  async findByPhone(phoneNumber: string) {
  return this.usersRepository.findOne({
    where: { phoneNumber },
  });
}

  async findByEmail(email: string) {
  return this.usersRepository.findOne({
    where: { email },
  });
}

async save(user: User): Promise<User> {
  return this.usersRepository.save(user);
}
}