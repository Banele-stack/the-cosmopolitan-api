import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { Business } from './entities/business.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { BusinessCategoryModule } from 'src/business-category/business-category.module';
import { BusinessCategory } from 'src/business-category/entities/business-category.entity';
import { BusinessSubcategory } from 'src/business-category/entities/business-subcategory.entity';
import { UploadsModule } from 'src/uploads/uploads.module';
import { GooglePlacesModule } from 'src/common/google-places/google-places.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, User, BusinessCategory, BusinessSubcategory]),
    BusinessCategoryModule,
    UploadsModule,
    GooglePlacesModule,
    // Caps new-listing creation specifically (not browsing) — the
    // duplicate-listing checks in BusinessService catch a bot resubmitting
    // the same listing, but not one grinding out many different fake ones;
    // this bounds that regardless of how varied they are. 10/day is well
    // above what a real person listing their own business needs.
    ThrottlerModule.forRoot([{ ttl: 86400000, limit: 10 }]),
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
