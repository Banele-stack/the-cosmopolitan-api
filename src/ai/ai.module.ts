import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BusinessModule } from 'src/business/business.module';
import { RoomModule } from 'src/room/room.module';
import { GigModule } from 'src/gigs/gig.module';
import { BusinessCategoryModule } from 'src/business-category/business-category.module';

@Module({
    imports: [
    RoomModule,
    BusinessModule,
    GigModule,
    BusinessCategoryModule,
  ],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
