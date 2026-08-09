import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

import { Business } from "../business/entities/business.entity";
import { Room } from "../room/entities/room.entity";
import { Gig } from "../gigs/entities/gig.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Business, Room, Gig])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}