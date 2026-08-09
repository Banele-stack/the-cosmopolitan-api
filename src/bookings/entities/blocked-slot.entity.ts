import { Business } from "src/business/entities/business.entity";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";

// An owner-declared exception to their normal schedule — a public holiday,
// a day off, a lunch break. startTime/endTime null means the whole date is
// blocked; set both to block just a window within the day.
@Entity("blocked_slots")
export class BlockedSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Business, { onDelete: "CASCADE" })
  business: Business;

  @Column("date")
  date: string;

  @Column({ nullable: true })
  startTime: string | null;

  @Column({ nullable: true })
  endTime: string | null;

  @Column({ nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
