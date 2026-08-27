import { User } from "src/users/entities/user.entity";
import { BusinessCategory } from "src/business-category/entities/business-category.entity";
import { BusinessSubcategory } from "src/business-category/entities/business-subcategory.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";

export type Location = {
  address?: string;
  area?: string;
  lat?: number;
  lng?: number;
};

export type OperatingHours = {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
};

@Entity("businesses")
export class Business {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  externalId: string;

  @ManyToOne(() => User, (user) => user.businesses)
owner: User;

  @Column()
  name: string;

  // Self-declared, unverified qualification/credential shown as a trust
  // signal on the listing (e.g. "BCom Accounting Graduate", "Final-year
  // Engineering Student", "SAIPA Certified Bookkeeper"). Nothing checks
  // this is true — same trust model as the rest of a listing's own
  // description — it exists so someone whose main asset is a qualification
  // (rather than years of trading history) has somewhere to show it.
  @Column({ nullable: true })
  credential: string | null;

  @ManyToOne(() => BusinessCategory, { nullable: false, eager: false })
  category: BusinessCategory;

  @ManyToOne(() => BusinessSubcategory, { nullable: true, eager: false })
  subcategory: BusinessSubcategory | null;

  @Column({ default: "physical" })
  businessType: "physical" | "online";

  @Column({ default: false })
  supportsDelivery: boolean;

  @Column({ default: false })
  supportsWhatsAppOrder: boolean;

  @Column({ nullable: true })
  whatsappNumber: string | null;

  // Contact number shown as the listing's "Call" action. Nullable because
  // existing rows predate this column — new listings are required (via
  // CreateBusinessDto) to supply one.
  @Column({ nullable: true })
  phoneNumber: string | null;

  @Column({ nullable: true })
  priceRange: "$" | "$$" | "$$$" | "$$$$" | null;

  @Column("float")
  rating: number;

  @Column()
  reviewCount: number;

  @Column({ default: 0 })
  reportCount: number;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  contactClickCount: number;

  @Column({ default: "active" })
  status: "active" | "pending_review" | "suspended";

  @CreateDateColumn()
  createdAt: Date;

  @Column("json", { nullable: true })
  location: Location | null;

  @Column("text")
  description: string;

  @Column("simple-array")
  images: string[];

  @Column("simple-array", { nullable: true })
  videos: string[] | null;

  @Column("json")
  operatingHours: OperatingHours;

  // Cache for the live Google Places photo lookup (see
  // GooglePlacesService) — used only when this listing has no photos of
  // its own. googlePhotoRef stays null both before the first lookup AND
  // after a lookup that found nothing; googlePhotoCheckedAt disambiguates
  // those (null = never checked), and gates how often we re-run the
  // lookup rather than re-querying Google on every page view.
  @Column({ nullable: true })
  googlePlaceId: string | null;

  @Column({ nullable: true })
  googlePhotoRef: string | null;

  @Column({ type: 'timestamp', nullable: true })
  googlePhotoCheckedAt: Date | null;
}