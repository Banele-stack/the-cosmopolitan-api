import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { GigService } from "./gig.service";
import { GigController } from "./gig.controller";
import { Gig } from "./entities/gig.entity";
import { User } from "src/users/entities/user.entity";
import { BusinessCategoryModule } from "src/business-category/business-category.module";
import { BusinessCategory } from "src/business-category/entities/business-category.entity";
import { BusinessSubcategory } from "src/business-category/entities/business-subcategory.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Gig, User, BusinessCategory, BusinessSubcategory]),
    BusinessCategoryModule,
    // See BusinessModule's identical registration for why: bounds
    // new-post creation regardless of how varied the fakes are.
    ThrottlerModule.forRoot([{ ttl: 86400000, limit: 10 }]),
  ],
  controllers: [GigController],
  providers: [GigService],
  exports: [GigService],
})
export class GigModule {}
