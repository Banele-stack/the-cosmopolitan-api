import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { BookingsService } from "./bookings.service";
import { UpdateBookingSettingsDto } from "./dto/update-booking-settings.dto";
import { CreateBlockedSlotDto } from "./dto/create-blocked-slot.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingStatusDto } from "./dto/update-booking-status.dto";

@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // --- Settings (owner) ---------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Get("business/:businessId/booking-settings")
  getSettings(@Param("businessId") businessId: string, @Req() req: any) {
    return this.bookingsService.getSettings(+businessId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("business/:businessId/booking-settings")
  updateSettings(
    @Param("businessId") businessId: string,
    @Body() dto: UpdateBookingSettingsDto,
    @Req() req: any,
  ) {
    return this.bookingsService.updateSettings(+businessId, req.user.sub, dto);
  }

  // --- Blocked slots (owner) ------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Post("business/:businessId/blocked-slots")
  createBlockedSlot(
    @Param("businessId") businessId: string,
    @Body() dto: CreateBlockedSlotDto,
    @Req() req: any,
  ) {
    return this.bookingsService.createBlockedSlot(
      +businessId,
      req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("business/:businessId/blocked-slots")
  listBlockedSlots(@Param("businessId") businessId: string, @Req() req: any) {
    return this.bookingsService.listBlockedSlots(+businessId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("blocked-slots/:id")
  removeBlockedSlot(@Param("id") id: string, @Req() req: any) {
    return this.bookingsService.removeBlockedSlot(+id, req.user.sub);
  }

  // --- Availability (public) ------------------------------------------

  @Get("business/:businessId/availability")
  getAvailability(
    @Param("businessId") businessId: string,
    @Query("date") date: string,
  ) {
    return this.bookingsService.getAvailability(+businessId, date);
  }

  // --- Bookings ---------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Post("business/:businessId/bookings")
  createBooking(
    @Param("businessId") businessId: string,
    @Body() dto: CreateBookingDto,
    @Req() req: any,
  ) {
    return this.bookingsService.createBooking(+businessId, req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("business/:businessId/bookings")
  listForBusiness(@Param("businessId") businessId: string, @Req() req: any) {
    return this.bookingsService.listForBusiness(+businessId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get("bookings/mine")
  listMine(@Req() req: any) {
    return this.bookingsService.listForCustomer(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("bookings/:id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateBookingStatusDto,
    @Req() req: any,
  ) {
    return this.bookingsService.updateStatus(+id, req.user.sub, dto.status);
  }
}
