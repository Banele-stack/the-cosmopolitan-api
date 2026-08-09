import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { Report } from "./entities/report.entity";
import { CreateReportDto } from "./dto/create-report.dto";
import { Room } from "src/room/entities/room.entity";
import { Business } from "src/business/entities/business.entity";
import { Gig } from "src/gigs/entities/gig.entity";
import { notifyAdminListingNeedsReview } from "src/common/notifications/admin-notify.helper";

const REPORT_THRESHOLD_FOR_REVIEW = 3;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(Gig)
    private readonly gigRepository: Repository<Gig>,
  ) {}

  async create(dto: CreateReportDto, userId: number) {
    if (dto.targetType === "room") {
      const room = await this.roomRepository.findOne({
        where: { id: dto.targetId },
      });

      if (!room) {
        throw new NotFoundException("Room not found.");
      }
    } else if (dto.targetType === "business") {
      const business = await this.businessRepository.findOne({
        where: { id: dto.targetId },
      });

      if (!business) {
        throw new NotFoundException("Business not found.");
      }
    } else {
      const gig = await this.gigRepository.findOne({
        where: { id: dto.targetId },
      });

      if (!gig) {
        throw new NotFoundException("Gig not found.");
      }
    }

    const report = this.reportRepository.create({
      targetType: dto.targetType,
      targetId: dto.targetId,
      reporter: { id: userId } as any,
      reason: dto.reason,
    });

    try {
      await this.reportRepository.save(report);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(
          "You've already reported this listing.",
        );
      }

      throw error;
    }

    if (dto.targetType === "room") {
      await this.roomRepository.increment(
        { id: dto.targetId },
        "reportCount",
        1,
      );

      const room = await this.roomRepository.findOne({
        where: { id: dto.targetId },
      });

      if (
        room &&
        room.status === "active" &&
        room.reportCount >= REPORT_THRESHOLD_FOR_REVIEW
      ) {
        await this.roomRepository.update(dto.targetId, {
          status: "pending_review",
        });

        notifyAdminListingNeedsReview({
          listingType: "room",
          listingId: room.id,
          listingName: room.name,
          reason: `Reported ${room.reportCount} times.`,
        }).catch(() => {});
      }
    } else if (dto.targetType === "business") {
      await this.businessRepository.increment(
        { id: dto.targetId },
        "reportCount",
        1,
      );

      const business = await this.businessRepository.findOne({
        where: { id: dto.targetId },
      });

      if (
        business &&
        business.status === "active" &&
        business.reportCount >= REPORT_THRESHOLD_FOR_REVIEW
      ) {
        await this.businessRepository.update(dto.targetId, {
          status: "pending_review",
        });

        notifyAdminListingNeedsReview({
          listingType: "business",
          listingId: business.id,
          listingName: business.name,
          reason: `Reported ${business.reportCount} times.`,
        }).catch(() => {});
      }
    } else {
      await this.gigRepository.increment(
        { id: dto.targetId },
        "reportCount",
        1,
      );

      const gig = await this.gigRepository.findOne({
        where: { id: dto.targetId },
      });

      if (
        gig &&
        gig.status === "active" &&
        gig.reportCount >= REPORT_THRESHOLD_FOR_REVIEW
      ) {
        await this.gigRepository.update(dto.targetId, {
          status: "pending_review",
        });

        notifyAdminListingNeedsReview({
          listingType: "gig",
          listingId: gig.id,
          listingName: gig.title,
          reason: `Reported ${gig.reportCount} times.`,
        }).catch(() => {});
      }
    }

    return {
      message: "Report submitted successfully.",
    };
  }
}
