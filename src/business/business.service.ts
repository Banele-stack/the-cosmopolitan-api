import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "./entities/business.entity";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(createBusinessDto: CreateBusinessDto) {
    const business = this.businessRepository.create(createBusinessDto);
    return await this.businessRepository.save(business);
  }

  async findAll() {
    return await this.businessRepository.find();
  }

  async findOne(id: number) {
    const business = await this.businessRepository.findOne({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException(`Business with id ${id} not found`);
    }

    return business;
  }

  async update(id: number, updateBusinessDto: UpdateBusinessDto) {
    const business = await this.businessRepository.preload({
      id,
      ...updateBusinessDto,
    });

    if (!business) {
      throw new NotFoundException(`Business with id ${id} not found`);
    }

    return await this.businessRepository.save(business);
  }

  async remove(id: number) {
    const business = await this.findOne(id);
    return await this.businessRepository.remove(business);
  }
}