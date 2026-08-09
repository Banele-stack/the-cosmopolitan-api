import { Business } from "src/business/entities/business.entity";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";

// "Closed" (matching Business.operatingHours' own convention) or a single
// "HH:MM - HH:MM" window — deliberately one window per day, not multiple,
// to keep the owner-facing settings form as simple as the rest of this
// app's forms. A business wanting a lunch break blocks it out instead via
// BlockedSlot rather than this needing two windows per day.
export type BookingSchedule = {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
};

export const CLOSED_SCHEDULE: BookingSchedule = {
  monday: "Closed",
  tuesday: "Closed",
  wednesday: "Closed",
  thursday: "Closed",
  friday: "Closed",
  saturday: "Closed",
  sunday: "Closed",
};

@Entity("business_booking_settings")
export class BusinessBookingSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn()
  business: Business;

  // Off by default — a business only starts showing "Book Now" once its
  // owner has actually reviewed and turned this on, rather than every
  // listing suddenly claiming to take bookings with untuned defaults.
  @Column({ default: false })
  bookingsEnabled: boolean;

  @Column({ default: 30 })
  slotDurationMinutes: number;

  // Gap left between the end of one slot and the start of the next.
  @Column({ default: 0 })
  bufferMinutes: number;

  // false = booking a slot confirms it immediately. true = it starts
  // "pending" until the owner confirms/declines.
  @Column({ default: false })
  requiresApproval: boolean;

  @Column("json")
  schedule: BookingSchedule;
}
