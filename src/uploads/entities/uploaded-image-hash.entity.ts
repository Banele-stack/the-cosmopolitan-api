import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "src/users/entities/user.entity";

@Entity("uploaded_image_hashes")
export class UploadedImageHash {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  hash: string;

  @Column()
  url: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  uploader: User;

  @CreateDateColumn()
  createdAt: Date;
}
