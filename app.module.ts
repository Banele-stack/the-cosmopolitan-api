import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RoomModule } from './room/room.module';
import { BusinessModule } from './business/business.module';
import { BusinessCategoryModule } from './business-category/business-category.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { GeocodeModule } from './geocode/geocode.module';
import { GigModule } from './gigs/gig.module';
import { BookingsModule } from './bookings/bookings.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),

    RoomModule,

    BusinessModule,

    BusinessCategoryModule,

    UsersModule,

    AuthModule,
    DashboardModule,
    AiModule,
    ReportsModule,
    AdminModule,
    GeocodeModule,
    GigModule,
    BookingsModule,
  ]
})
export class AppModule {}