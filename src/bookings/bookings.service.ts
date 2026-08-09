import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import { Business } from "src/business/entities/business.entity";
import { User } from "src/users/entities/user.entity";
import { ClickatellService } from "src/common/sms/clickatell.service";

import { Booking, BookingStatus } from "./entities/booking.entity";
import {
  BusinessBookingSettings,
  CLOSED_SCHEDULE,
} from "./entities/business-booking-settings.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";
import { UpdateBookingSettingsDto } from "./dto/update-booking-settings.dto";
import { CreateBlockedSlotDto } from "./dto/create-blocked-slot.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Business/Booking relations pull in `owner`/`customer` as full User
// entities, passwordHash included — TypeORM has no field-level exclusion
// for relations the way it does for a repository's own `select`, so every
// response that could carry a nested User is sanitized by hand here
// before it reaches a controller.
function stripUser(user: User | null | undefined) {
  if (!user) return user ?? null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function sanitizeBusiness(business: Business | null | undefined) {
  if (!business) return business ?? null;
  return { ...business, owner: stripUser(business.owner) };
}

function sanitizeSettings(settings: BusinessBookingSettings) {
  return { ...settings, business: sanitizeBusiness(settings.business) };
}

function sanitizeBlockedSlot(blocked: BlockedSlot) {
  return { ...blocked, business: sanitizeBusiness(blocked.business) };
}

function sanitizeBooking(booking: Booking) {
  return {
    ...booking,
    business: sanitizeBusiness(booking.business),
    customer: stripUser(booking.customer),
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(BusinessBookingSettings)
    private readonly settingsRepository: Repository<BusinessBookingSettings>,

    @InjectRepository(BlockedSlot)
    private readonly blockedSlotRepository: Repository<BlockedSlot>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    private readonly sms: ClickatellService,
  ) {}

  private async findBusinessOrThrow(businessId: number) {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: { owner: true },
    });

    if (!business) {
      throw new NotFoundException(`Business with id ${businessId} not found`);
    }

    return business;
  }

  private assertOwner(business: Business, userId: number) {
    if (business.owner.id !== userId) {
      throw new ForbiddenException(
        "You can only manage bookings for your own business.",
      );
    }
  }

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------

  async getSettings(businessId: number, ownerId: number) {
    const business = await this.findBusinessOrThrow(businessId);
    this.assertOwner(business, ownerId);

    return sanitizeSettings(await this.getOrCreateSettings(business));
  }

  // Lazily creates a settings row the first time it's needed, defaulting
  // the schedule from the business's own operatingHours where possible
  // (same shape, so it's a sensible starting point) rather than making
  // the owner fill in a whole new weekly schedule from scratch.
  private async getOrCreateSettings(business: Business) {
    let settings = await this.settingsRepository.findOne({
      where: { business: { id: business.id } },
    });

    if (!settings) {
      const seeded = business.operatingHours
        ? { ...CLOSED_SCHEDULE, ...business.operatingHours }
        : CLOSED_SCHEDULE;

      settings = this.settingsRepository.create({
        business,
        bookingsEnabled: false,
        slotDurationMinutes: 30,
        bufferMinutes: 0,
        requiresApproval: false,
        schedule: seeded,
      });
      settings = await this.settingsRepository.save(settings);
    }

    return settings;
  }

  async updateSettings(
    businessId: number,
    ownerId: number,
    dto: UpdateBookingSettingsDto,
  ) {
    const business = await this.findBusinessOrThrow(businessId);
    this.assertOwner(business, ownerId);

    const settings = await this.getOrCreateSettings(business);

    if (dto.bookingsEnabled != null) settings.bookingsEnabled = dto.bookingsEnabled;
    if (dto.slotDurationMinutes != null) settings.slotDurationMinutes = dto.slotDurationMinutes;
    if (dto.bufferMinutes != null) settings.bufferMinutes = dto.bufferMinutes;
    if (dto.requiresApproval != null) settings.requiresApproval = dto.requiresApproval;
    if (dto.schedule) settings.schedule = { ...settings.schedule, ...dto.schedule };

    return sanitizeSettings(await this.settingsRepository.save(settings));
  }

  // ---------------------------------------------------------------------
  // Blocked slots
  // ---------------------------------------------------------------------

  async createBlockedSlot(
    businessId: number,
    ownerId: number,
    dto: CreateBlockedSlotDto,
  ) {
    const business = await this.findBusinessOrThrow(businessId);
    this.assertOwner(business, ownerId);

    const blocked = this.blockedSlotRepository.create({
      business,
      date: dto.date,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      reason: dto.reason ?? null,
    });

    return sanitizeBlockedSlot(await this.blockedSlotRepository.save(blocked));
  }

  async listBlockedSlots(businessId: number, ownerId: number) {
    const business = await this.findBusinessOrThrow(businessId);
    this.assertOwner(business, ownerId);

    return this.blockedSlotRepository.find({
      where: { business: { id: businessId } },
      order: { date: "ASC" },
    });
  }

  async removeBlockedSlot(id: number, ownerId: number) {
    const blocked = await this.blockedSlotRepository.findOne({
      where: { id },
      relations: { business: { owner: true } },
    });

    if (!blocked) {
      throw new NotFoundException(`Blocked slot with id ${id} not found`);
    }

    this.assertOwner(blocked.business, ownerId);

    return sanitizeBlockedSlot(await this.blockedSlotRepository.remove(blocked));
  }

  // ---------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------

  // Slots are computed on the fly from the weekly schedule minus existing
  // bookings minus blocked time — nothing is pre-generated/stored, so
  // there's no batch job to keep a slot table in sync with schedule
  // changes.
  async getAvailability(businessId: number, date: string) {
    const business = await this.findBusinessOrThrow(businessId);
    const settings = await this.settingsRepository.findOne({
      where: { business: { id: businessId } },
    });

    if (!settings || !settings.bookingsEnabled) {
      return { enabled: false, slotDurationMinutes: null, slots: [] };
    }

    const dayName = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
    const hours = settings.schedule[dayName];

    if (!hours || hours === "Closed") {
      return {
        enabled: true,
        slotDurationMinutes: settings.slotDurationMinutes,
        slots: [],
      };
    }

    const [openStr, closeStr] = hours.split(" - ");
    const openMin = toMinutes(openStr);
    const closeMin = toMinutes(closeStr);
    const step = settings.slotDurationMinutes + settings.bufferMinutes;

    const candidates: { start: string; end: string }[] = [];
    for (
      let t = openMin;
      t + settings.slotDurationMinutes <= closeMin;
      t += step
    ) {
      candidates.push({
        start: fromMinutes(t),
        end: fromMinutes(t + settings.slotDurationMinutes),
      });
    }

    const [blocked, bookings] = await Promise.all([
      this.blockedSlotRepository.find({
        where: { business: { id: businessId }, date },
      }),
      this.bookingRepository.find({
        where: {
          business: { id: businessId },
          date,
          status: In(["pending", "confirmed"]),
        },
      }),
    ]);

    const isToday = date === todayISO();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    const free = candidates.filter((slot) => {
      const start = toMinutes(slot.start);
      const end = toMinutes(slot.end);

      if (isToday && start <= nowMin) return false;

      for (const b of blocked) {
        // No start/end on the blocked row means the whole day is blocked.
        if (!b.startTime || !b.endTime) return false;
        if (rangesOverlap(start, end, toMinutes(b.startTime), toMinutes(b.endTime))) {
          return false;
        }
      }

      for (const booking of bookings) {
        if (
          rangesOverlap(
            start,
            end,
            toMinutes(booking.startTime),
            toMinutes(booking.endTime),
          )
        ) {
          return false;
        }
      }

      return true;
    });

    return {
      enabled: true,
      slotDurationMinutes: settings.slotDurationMinutes,
      slots: free,
    };
  }

  // ---------------------------------------------------------------------
  // Bookings
  // ---------------------------------------------------------------------

  async createBooking(
    businessId: number,
    customerId: number,
    dto: CreateBookingDto,
  ) {
    const business = await this.findBusinessOrThrow(businessId);

    const settings = await this.settingsRepository.findOne({
      where: { business: { id: businessId } },
    });

    if (!settings || !settings.bookingsEnabled) {
      throw new BadRequestException(
        "This business isn't accepting bookings right now.",
      );
    }

    const availability = await this.getAvailability(businessId, dto.date);
    const match = availability.slots.find((s) => s.start === dto.startTime);

    if (!match) {
      throw new ConflictException(
        "That time is no longer available — please pick another slot.",
      );
    }

    const customer = await this.userRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException("User not found");
    }

    const booking = this.bookingRepository.create({
      business,
      customer,
      date: dto.date,
      startTime: match.start,
      endTime: match.end,
      notes: dto.notes ?? null,
      status: settings.requiresApproval ? "pending" : "confirmed",
    });

    const saved = await this.bookingRepository.save(booking);

    // Best-effort — a failed text should never undo a valid booking.
    this.notifyNewBooking(saved, business, customer, settings.requiresApproval).catch(
      () => {},
    );

    return sanitizeBooking(saved);
  }

  private async notifyNewBooking(
    booking: Booking,
    business: Business,
    customer: User,
    requiresApproval: boolean,
  ) {
    const when = `${booking.date} at ${booking.startTime}`;

    if (customer.phoneNumber) {
      const customerMsg = requiresApproval
        ? `Cosmopolitan: Your booking request with ${business.name} for ${when} has been sent. You'll be notified once it's confirmed.`
        : `Cosmopolitan: Your booking with ${business.name} for ${when} is confirmed.`;
      await this.sms.sendSms(customer.phoneNumber, customerMsg);
    }

    if (business.owner?.phoneNumber) {
      const ownerMsg = requiresApproval
        ? `Cosmopolitan: New booking request from ${customer.firstName} ${customer.surname} for ${when}. Confirm it in your dashboard.`
        : `Cosmopolitan: New booking from ${customer.firstName} ${customer.surname} for ${when}.`;
      await this.sms.sendSms(business.owner.phoneNumber, ownerMsg);
    }
  }

  async listForBusiness(businessId: number, ownerId: number) {
    const business = await this.findBusinessOrThrow(businessId);
    this.assertOwner(business, ownerId);

    const bookings = await this.bookingRepository.find({
      where: { business: { id: businessId } },
      relations: { customer: true },
      order: { date: "ASC", startTime: "ASC" },
    });

    return bookings.map(sanitizeBooking);
  }

  async listForCustomer(customerId: number) {
    const bookings = await this.bookingRepository.find({
      where: { customer: { id: customerId } },
      relations: { business: true },
      order: { date: "DESC", startTime: "DESC" },
    });

    // business.owner isn't loaded here, so sanitizeBusiness's owner-strip
    // is a no-op — kept for consistency in case that ever changes.
    return bookings.map((b) => ({ ...b, business: sanitizeBusiness(b.business) }));
  }

  async updateStatus(
    bookingId: number,
    actorId: number,
    status: BookingStatus,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { business: { owner: true }, customer: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${bookingId} not found`);
    }

    const isOwner = booking.business.owner.id === actorId;
    const isCustomer = booking.customer.id === actorId;

    if (!isOwner && !isCustomer) {
      throw new ForbiddenException("You don't have access to this booking.");
    }

    // A customer can only cancel — every other transition (confirm,
    // complete, no-show) is the business owner's call.
    if (isCustomer && !isOwner && status !== "cancelled") {
      throw new ForbiddenException("You can only cancel your own booking.");
    }

    const previousStatus = booking.status;
    booking.status = status;
    const saved = await this.bookingRepository.save(booking);

    if (status !== previousStatus) {
      this.notifyStatusChange(saved, isOwner).catch(() => {});
    }

    return sanitizeBooking(saved);
  }

  private async notifyStatusChange(booking: Booking, changedByOwner: boolean) {
    const when = `${booking.date} at ${booking.startTime}`;
    const label = booking.status.replace("_", " ");

    // Notify whichever side didn't make the change.
    if (changedByOwner && booking.customer.phoneNumber) {
      await this.sms.sendSms(
        booking.customer.phoneNumber,
        `Cosmopolitan: Your booking for ${when} is now ${label}.`,
      );
    } else if (!changedByOwner && booking.business.owner?.phoneNumber) {
      await this.sms.sendSms(
        booking.business.owner.phoneNumber,
        `Cosmopolitan: A booking for ${when} is now ${label}.`,
      );
    }
  }
}
