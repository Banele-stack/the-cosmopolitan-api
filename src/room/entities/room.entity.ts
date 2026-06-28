import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Room {
@PrimaryGeneratedColumn()
id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column('decimal')
  price: number;

  @Column('json')
  location: {
    address: string;
    area: string;
  };

  @Column('text')
  description: string;

  @Column()
  bedrooms: number;

  @Column()
  bathrooms: number;

  @Column()
  size: number;

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

  @Column('simple-array')
  images: string[];

  @Column('json', { nullable: true })
  reviews?: {
    id: string;
    name: string;
    rating: number;
    comment: string;
    createdAt: string;
  }[];
}