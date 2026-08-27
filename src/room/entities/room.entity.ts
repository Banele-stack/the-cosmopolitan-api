import { User } from 'src/users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';

// name/reviewerId come from the submitting account, not free text — a
// review used to let anyone type any name at all, which is trivially
// spoofable and untraceable. status gates whether it's counted in
// rating/reviewCount and shown publicly; see RoomService.addReview /
// approveReview.
export type RoomReview = {
  id: string;
  reviewerId: number;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
};

@Entity()
export class Room {
@PrimaryGeneratedColumn()
id: number;

  @Column()
  name: string;

  @ManyToOne(() => User, (user) => user.rooms)
owner: User;

  @Column()
  category: string;

  @Column('decimal')
  price: number;

 @Column("json")
location: {
  address: string;
  area: string;
  lat: number;
  lng: number;
};

  @Column('text')
  description: string;

  @Column()
  bedrooms: number;

  // Nullable — some real listings (e.g. sourced from a landlord's own
  // published info rather than a self-serve form) don't state this. The
  // frontend shows "Contact landlord for details" rather than blocking the
  // whole listing on one missing field. See availableFrom/deposit/leaseTerm
  // below for the same reasoning.
  @Column({ nullable: true })
  bathrooms: number | null;

  // Nullable — most people renting out a room don't know its exact m²,
  // so it's asked for but never required (see CreateRoomDto).
  @Column({ nullable: true })
  size: number | null;

  @Column({ default: false })
  furnished: boolean;

  @Column({ default: false })
  wifi: boolean;

  @Column({ default: false })
  parking: boolean;

  @Column({ default: false })
  electricityIncluded: boolean;

  @Column({ default: false })
  waterIncluded: boolean;

  @Column({ default: false })
  petsAllowed: boolean;

  @Column({ default: false })
  kitchen: boolean;

  @Column({ nullable: true })
  kitchenType?: string;

  @Column({ default: false })
  diningArea: boolean;

  @Column({ default: false })
  livingRoom: boolean;

  @Column({ default: false })
  balcony: boolean;

  // Contact numbers shown on the listing's Call/WhatsApp actions. Nullable
  // because existing rows predate these columns — new listings are
  // required (via CreateRoomDto) to supply at least phoneNumber.
  @Column({ nullable: true })
  phoneNumber: string | null;

  @Column({ nullable: true })
  whatsappNumber: string | null;

  @Column({ nullable: true })
  security?: string;

  @Column({ nullable: true })
  parkingType?: string;

  @Column({ nullable: true })
  internetSpeed?: string;

  @Column({ default: false })
  smokingAllowed: boolean;

  @Column({ nullable: true })
  noiseRule?: string;

  @Column()
  propertyType: string;

  // Nullable — see bathrooms above.
  @Column({ type: 'date', nullable: true })
  availableFrom: Date | null;

  @Column('decimal', { nullable: true })
  deposit: number | null;

  @Column({ nullable: true })
  leaseTerm: string | null;

  @Column('float', { default: 0 })
  rating: number;

  @Column({ default: 0 })
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

  @Column('simple-array')
  images: string[];

  @Column('simple-array', { nullable: true })
  videos: string[] | null;

  @Column('json', { nullable: true })
  reviews?: RoomReview[];

  // Cache for the live Google Places photo lookup (see
  // GooglePlacesService / business.entity.ts's identical fields) — used
  // only when this listing has no photos of its own.
  @Column({ nullable: true })
  googlePlaceId: string | null;

  @Column({ nullable: true })
  googlePhotoRef: string | null;

  @Column({ type: 'timestamp', nullable: true })
  googlePhotoCheckedAt: Date | null;
}