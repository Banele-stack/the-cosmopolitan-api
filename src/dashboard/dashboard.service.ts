import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Business } from "../business/entities/business.entity";
import { Room } from "../room/entities/room.entity";
import { Gig } from "../gigs/entities/gig.entity";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    @InjectRepository(Gig)
    private readonly gigRepository: Repository<Gig>,
  ) {}

  async getDashboard(userId: number) {
    const [businesses, rooms, gigs] = await Promise.all([
      this.businessRepository.find({
        where: {
          owner: {
            id: userId,
          },
        },
      }),

      this.roomRepository.find({
        where: {
          owner: {
            id: userId,
          },
        },
      }),

      this.gigRepository.find({
        where: {
          owner: {
            id: userId,
          },
        },
        relations: { category: true, subcategory: true },
        order: { createdAt: "DESC" },
      }),
    ]);

    return {
      businesses,
      rooms,
      gigs,
    };
  }
}