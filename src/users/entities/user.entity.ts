import { Business } from "src/business/entities/business.entity";
import { Room } from "src/room/entities/room.entity";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  surname: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  email?: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Index({ unique: true })
  @Column({ nullable: true })
  phoneNumber?: string;

   @Column({ default: false })
  phoneVerified: boolean;

  @Column()
  passwordHash: string;

  // Facebook, LinkedIn, or any other profile link the user wants to share.
  @Column({ nullable: true })
  socialLink?: string;

  // This owner's TikTok profile — shown on every listing/room they create.
  // Nullable so a real value can be added later without a migration; until
  // then, DEFAULT_TIKTOK_URL fills in for display (see social.constants.ts).
  @Column({ nullable: true })
  tiktokUrl?: string;

  @Column({ default: "user" })
  role: "user" | "admin";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Business, (business) => business.owner)
businesses: Business[];

@OneToMany(() => Room, (room) => room.owner)
rooms: Room[];
}