import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity()
export class Auth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  surname: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  email?: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  phoneNumber?: string;

  @Column()
  passwordHash: string;

  @Column({ default: false })
  isVerified: boolean;
}