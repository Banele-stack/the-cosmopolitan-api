import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

import { Business } from "src/business/entities/business.entity";
import { User } from "src/users/entities/user.entity";
import { Booking } from "./entities/booking.entity";
import { BusinessBookingSettings } from "./entities/business-booking-settings.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";
import { SmsModule } from "src/common/sms/sms.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      User,
      Booking,
      BusinessBookingSettings,
      BlockedSlot,
    ]),
    SmsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
