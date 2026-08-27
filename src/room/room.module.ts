import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { Room } from './entities/room.entity';
import { User } from 'src/users/entities/user.entity';
import { UploadsModule } from 'src/uploads/uploads.module';
import { GooglePlacesModule } from 'src/common/google-places/google-places.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Room, User]),
    UploadsModule,
    GooglePlacesModule,
    // See BusinessModule's identical registration for why: bounds
    // new-listing creation regardless of how varied the fakes are.
    ThrottlerModule.forRoot([{ ttl: 86400000, limit: 10 }]),
  ],
  controllers: [RoomController],
  providers: [RoomService],
   exports: [RoomService],
})
export class RoomModule {}