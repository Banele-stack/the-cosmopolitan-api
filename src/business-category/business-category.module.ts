import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessCategoryService } from './business-category.service';
import { BusinessCategoryController } from './business-category.controller';
import { BusinessCategory } from './entities/business-category.entity';
import { BusinessSubcategory } from './entities/business-subcategory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessCategory, BusinessSubcategory])],
  controllers: [BusinessCategoryController],
  providers: [BusinessCategoryService],
  exports: [BusinessCategoryService],
})
export class BusinessCategoryModule {}
