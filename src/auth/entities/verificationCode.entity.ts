import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class VerificationCode {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  code: string;

  @Column()
  type: "email" | "phone";

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}