import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from "typeorm";
import { User } from "src/users/entities/user.entity";

@Entity("reports")
@Unique(["reporter", "targetType", "targetId"])
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  targetType: "room" | "business" | "gig";

  @Column()
  targetId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  reporter: User;

  @Column()
  reason: string;

  @Column({ default: "pending" })
  status: "pending" | "reviewed" | "dismissed";

  @CreateDateColumn()
  createdAt: Date;
}
