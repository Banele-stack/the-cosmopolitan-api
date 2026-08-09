import { User } from "src/users/entities/user.entity";
import { Business } from "src/business/entities/business.entity";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Business, { onDelete: "CASCADE" })
  business: Business;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  customer: User;

  @Column("date")
  date: string;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column({ nullable: true })
  notes: string | null;

  @Column({ default: "confirmed" })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;
}
