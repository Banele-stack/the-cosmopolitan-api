import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RolesGuard } from "src/auth/roles.guard";
import { Roles } from "src/auth/roles.decorator";
import { AdminService } from "./admin.service";
import { UpdateListingStatusDto } from "./dto/update-listing-status.dto";
import { UpdateReviewStatusDto } from "./dto/update-review-status.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("listings")
  getListings(
    @Query("status") status: "active" | "pending_review" | "suspended" = "pending_review",
  ) {
    return this.adminService.getListings(status);
  }

  @Get("reports")
  getReports() {
    return this.adminService.getReports();
  }

  @Patch("rooms/:id/status")
  updateRoomStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.adminService.updateRoomStatus(id, dto.status);
  }

  @Patch("business/:id/status")
  updateBusinessStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.adminService.updateBusinessStatus(id, dto.status);
  }

  @Patch("gigs/:id/status")
  updateGigStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.adminService.updateGigStatus(id, dto.status);
  }

  @Get("stats")
  getStats() {
    return this.adminService.getStats();
  }

  @Get("reviews")
  getPendingReviews() {
    return this.adminService.getPendingReviews();
  }

  @Patch("reviews/:roomId/:reviewId/status")
  setReviewStatus(
    @Param("roomId", ParseIntPipe) roomId: number,
    @Param("reviewId") reviewId: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.adminService.setReviewStatus(roomId, reviewId, dto.status);
  }
}
