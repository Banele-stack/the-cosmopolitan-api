import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Room } from "src/room/entities/room.entity";
import { Business } from "src/business/entities/business.entity";
import { Gig } from "src/gigs/entities/gig.entity";
import { Report } from "src/reports/entities/report.entity";
import { User } from "src/users/entities/user.entity";
import { RoomModule } from "src/room/room.module";
import { BusinessModule } from "src/business/business.module";
import { GigModule } from "src/gigs/gig.module";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, Business, Gig, Report, User]),
    RoomModule,
    BusinessModule,
    GigModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
