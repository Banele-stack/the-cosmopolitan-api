import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

export type Location = {
  address: string;
  area: string;
  lat: number;
  lng: number;
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

  @Column()
  name: string;

  @Column()
  category: string;

  @Column("float")
  rating: number;

  @Column()
  reviewCount: number;

  @Column("json")
  location: Location;

  @Column("text")
  description: string;

  @Column("simple-array")
  images: string[];

  @Column("json")
  operatingHours: OperatingHours;
}