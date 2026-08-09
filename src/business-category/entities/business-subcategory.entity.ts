import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BusinessCategory } from './business-category.entity';

@Entity('business_subcategories')
@Unique(['category', 'slug'])
export class BusinessSubcategory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BusinessCategory, (category) => category.subcategories, {
    onDelete: 'CASCADE',
  })
  category: BusinessCategory;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ default: 0 })
  sortOrder: number;
}
