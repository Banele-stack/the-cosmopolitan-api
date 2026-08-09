import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Report } from "./entities/report.entity";
import { Room } from "src/room/entities/room.entity";
import { Business } from "src/business/entities/business.entity";
import { Gig } from "src/gigs/entities/gig.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Report, Room, Business, Gig])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
