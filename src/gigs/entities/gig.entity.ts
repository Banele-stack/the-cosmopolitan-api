import { User } from "src/users/entities/user.entity";
import { BusinessCategory } from "src/business-category/entities/business-category.entity";
import { BusinessSubcategory } from "src/business-category/entities/business-subcategory.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";

export type GigLocation = {
  address: string;
  area: string;
  lat: number;
  lng: number;
};

// A same-day local task post — either "I need this done" or "I'm available
// to help" — matched by proximity the same way Room/Business are. See
// GigService for why this reuses the BusinessCategory tree instead of its
// own taxonomy, and why contact is WhatsApp-only (whatsappNumber required,
// no separate phone field — unlike Business, there's no fallback contact
// method here).
@Entity("gigs")
export class Gig {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  owner: User;

  @Column()
  type: "need_help" | "offering_work";

  @Column()
  title: string;

  @Column("text")
  description: string;

  @ManyToOne(() => BusinessCategory, { nullable: true, eager: false })
  category: BusinessCategory | null;

  @ManyToOne(() => BusinessSubcategory, { nullable: true, eager: false })
  subcategory: BusinessSubcategory | null;

  @Column("decimal", { nullable: true })
  price: number | null;

  @Column({ default: "negotiable" })
  priceType: "fixed" | "hourly" | "negotiable";

  @Column({ default: "flexible" })
  urgency: "today" | "this_week" | "flexible";

  // Computed server-side from urgency at creation time — see
  // GigService.URGENCY_TTL_MS. findAll() filters on this directly rather
  // than running a cron to flip expired posts, matching how report
  // auto-moderation checks its threshold inline instead of via a queue.
  @Column()
  expiresAt: Date;

  @Column("json")
  location: GigLocation;

  @Column()
  whatsappNumber: string;

  @Column({ default: 0 })
  reportCount: number;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  contactClickCount: number;

  @Column({ default: "active" })
  status: "active" | "filled" | "expired" | "pending_review" | "suspended";

  @CreateDateColumn()
  createdAt: Date;
}
