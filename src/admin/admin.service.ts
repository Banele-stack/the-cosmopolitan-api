import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import { Room } from "src/room/entities/room.entity";
import { Business } from "src/business/entities/business.entity";
import { Gig } from "src/gigs/entities/gig.entity";
import { Report } from "src/reports/entities/report.entity";
import { User } from "src/users/entities/user.entity";
import { RoomService } from "src/room/room.service";
import { BusinessService } from "src/business/business.service";
import { GigService } from "src/gigs/gig.service";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(Gig)
    private readonly gigRepository: Repository<Gig>,

    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly roomService: RoomService,
    private readonly businessService: BusinessService,
    private readonly gigService: GigService,
  ) {}

  async getListings(status: "active" | "pending_review" | "suspended") {
    const [rooms, businesses, gigs] = await Promise.all([
      this.roomRepository.find({ where: { status }, order: { id: "DESC" } }),
      this.businessRepository.find({ where: { status }, order: { id: "DESC" } }),
      this.gigRepository.find({ where: { status }, order: { id: "DESC" } }),
    ]);

    return { rooms, businesses, gigs };
  }

  async getReports() {
    return this.reportRepository.find({
      relations: { reporter: true },
      order: { createdAt: "DESC" },
    });
  }

  updateRoomStatus(id: number, status: "active" | "pending_review" | "suspended") {
    return this.roomService.updateStatus(id, status);
  }

  updateBusinessStatus(id: number, status: "active" | "pending_review" | "suspended") {
    return this.businessService.updateStatus(id, status);
  }

  updateGigStatus(id: number, status: "active" | "pending_review" | "suspended") {
    return this.gigService.updateStatus(id, status);
  }

  getPendingReviews() {
    return this.roomService.getPendingReviews();
  }

  setReviewStatus(roomId: number, reviewId: string, status: "approved" | "rejected") {
    return this.roomService.setReviewStatus(roomId, reviewId, status);
  }

  async getStats() {
    const since = new Date(Date.now() - MS_PER_WEEK);

    const [
      totalUsers,
      newUsersThisWeek,
      activeRooms,
      activeBusinesses,
      activeGigs,
      pendingRooms,
      pendingBusinesses,
      pendingGigs,
      pendingReports,
      pendingReviews,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.roomRepository.count({ where: { status: "active" } }),
      this.businessRepository.count({ where: { status: "active" } }),
      this.gigRepository.count({ where: { status: "active" } }),
      this.roomRepository.count({ where: { status: "pending_review" } }),
      this.businessRepository.count({ where: { status: "pending_review" } }),
      this.gigRepository.count({ where: { status: "pending_review" } }),
      this.reportRepository.count({ where: { status: "pending" } }),
      this.roomService.getPendingReviews().then((r) => r.length),
    ]);

    return {
      totalUsers,
      newUsersThisWeek,
      listings: {
        rooms: activeRooms,
        businesses: activeBusinesses,
        gigs: activeGigs,
      },
      pending: {
        listings: pendingRooms + pendingBusinesses + pendingGigs,
        reports: pendingReports,
        reviews: pendingReviews,
      },
    };
  }
}
