import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BusinessSubcategory } from './business-subcategory.entity';

@Entity('business_categories')
export class BusinessCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => BusinessSubcategory, (subcategory) => subcategory.category)
  subcategories: BusinessSubcategory[];
}
