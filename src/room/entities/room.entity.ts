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

  @Column()
  bathrooms: number;

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

  @Column({ type: 'date' })
  availableFrom: Date;

  @Column('decimal')
  deposit: number;

  @Column()
  leaseTerm: string;

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
}