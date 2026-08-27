import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { Room, RoomReview } from './entities/room.entity';
import { User } from 'src/users/entities/user.entity';
import { parsePaginationParams, paginate } from 'src/common/pagination/pagination.util';
import { haversineKmExpr, resolveNearbyRadius, NearbyMeta } from 'src/common/geo/geo.util';
import {
  notifyAdminListingNeedsReview,
  notifyAdminReviewNeedsApproval,
} from 'src/common/notifications/admin-notify.helper';
import { DEFAULT_TIKTOK_URL } from 'src/common/social/social.constants';
import { GooglePlacesService } from 'src/common/google-places/google-places.service';

// See business.service.ts's identical constant for why.
const GOOGLE_PHOTO_CACHE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Mirrors the price buckets used by the "filter" query param in findAll(),
// so near-duplicate detection groups listings the same way search does.
function getRoomPriceBracket(price: number): { min: number; max: number } {
  if (price < 2000) return { min: 0, max: 2000 };
  if (price < 4000) return { min: 2000, max: 4000 };
  if (price < 6000) return { min: 4000, max: 6000 };
  if (price < 10000) return { min: 6000, max: 10000 };
  return { min: 10000, max: Number.MAX_SAFE_INTEGER };
}

// Exposes only whether the owner is verified, never their raw email/phone —
// and only ever shows reviews that have cleared moderation. Pending/
// rejected reviews stay in the `reviews` column (admin needs them) but
// never reach a public findOne/findAll response.
function withOwnerVerified(room: Room) {
  const { owner, reviews, ...rest } = room;
  return {
    ...rest,
    reviews: (reviews ?? []).filter((r) => r.status === "approved"),
    ownerId: owner?.id,
    ownerVerified: Boolean(owner?.phoneVerified),
    ownerTiktokUrl: owner?.tiktokUrl || DEFAULT_TIKTOK_URL,
    // Facebook, LinkedIn, or whatever else the owner put in their profile —
    // unlike TikTok, there's no platform-wide fallback for this one, so it
    // just doesn't render (see SocialLinkButton) when unset.
    ownerSocialUrl: owner?.socialLink || undefined,
  };
}

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    @InjectRepository(User)
        private readonly userRepository: Repository<User>,

    private readonly googlePlacesService: GooglePlacesService,
  ) {}

// room.service.ts
async create(
  dto: CreateRoomDto,
  userId: number,
) {
  const owner = await this.userRepository.findOne({
    where: {
      id: userId,
    },
  });

  if (!owner) {
    throw new Error("User not found");
  }

  if (!owner.emailVerified && !owner.phoneVerified) {
    throw new ForbiddenException(
      "Please verify your email or phone number before creating a listing.",
    );
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentDuplicate = await this.roomRepository
    .createQueryBuilder("room")
    .where("room.ownerId = :ownerId", { ownerId: owner.id })
    .andWhere("LOWER(room.name) = LOWER(:name)", { name: dto.name })
    .andWhere("room.category = :category", { category: dto.category })
    .andWhere("room.price = :price", { price: dto.price })
    .andWhere("room.location->>'area' = :area", { area: dto.location?.area })
    .andWhere("room.createdAt >= :since", { since: fiveMinutesAgo })
    .getOne();

  if (recentDuplicate) {
    throw new ConflictException(
      "You already have a very similar listing — did you mean to submit twice?",
    );
  }

  const priceBracket = getRoomPriceBracket(dto.price);

  const isNearDuplicateOfOtherOwner = await this.roomRepository
    .createQueryBuilder("room")
    .where("room.ownerId != :ownerId", { ownerId: owner.id })
    .andWhere("room.status = 'active'")
    .andWhere("LOWER(room.name) = LOWER(:name)", { name: dto.name.trim() })
    .andWhere("room.category = :category", { category: dto.category })
    .andWhere("room.location->>'area' = :area", { area: dto.location?.area })
    .andWhere("room.price BETWEEN :min AND :max", priceBracket)
    .getExists();

  const room = this.roomRepository.create({
    owner,
    name: dto.name,
    category: dto.category,
    propertyType: dto.propertyType,
    price: dto.price,
    location: dto.location,
    description: dto.description,
    phoneNumber: dto.phoneNumber,
    whatsappNumber: dto.whatsappNumber ?? null,
    bedrooms: dto.bedrooms,
    bathrooms: dto.bathrooms,
    size: dto.size ?? null,
    availableFrom: dto.availableFrom,
    deposit: dto.deposit,
    leaseTerm: dto.leaseTerm,
    furnished: dto.amenities?.furnished ?? false,
    parking: dto.amenities?.parking ?? false,
    wifi: dto.amenities?.wifi ?? false,
    electricityIncluded: dto.amenities?.electricityIncluded ?? false,
    waterIncluded: dto.amenities?.waterIncluded ?? false,
    petsAllowed: dto.amenities?.petsAllowed ?? false,
    kitchen: false,
    diningArea: false,
    livingRoom: false,
    balcony: false,
    smokingAllowed: false,
    kitchenType: null,
    security: null,
    parkingType: null,
    internetSpeed: null,
    noiseRule: null,
    rating: 0,
    reviewCount: 0,
    reportCount: 0,
    status: isNearDuplicateOfOtherOwner ? "pending_review" : "active",
    images: dto.images ?? [], // This will now contain the uploaded image URLs
    videos: dto.videos ?? [],
    reviews: [],
  });

  const saved = await this.roomRepository.save(room);

  if (isNearDuplicateOfOtherOwner) {
    notifyAdminListingNeedsReview({
      listingType: "room",
      listingId: saved.id,
      listingName: saved.name,
      reason:
        "Looks like a near-duplicate of another owner's existing listing (same name, category, area, and price bracket).",
    }).catch(() => {});
  }

  return withOwnerVerified(saved);
}

async findAll(
  filters?: {
    location?: string;
    filter?: string;
    activeTags?: string[];
    lat?: number;
    lng?: number;
  },
  pagination?: {
    page?: number | string;
    limit?: number | string;
  },
) {
  const isNearMe =
    filters?.lat != null &&
    filters?.lng != null &&
    (!filters.location ||
      filters.location === "Near Me");

  // Builds every filter *except* the geolocation radius/sort, so the same
  // set of andWhere()s can be re-run per radius level below (resolveNearbyRadius
  // calls this fresh for each level it probes with .getCount()).
  // `skipAreaFilter` lets the province/region fallback below re-run every
  // other filter without the exact-area match that's already been proven
  // empty.
  const buildQuery = (opts?: { skipAreaFilter?: boolean }) => {
    const query =
      this.roomRepository.createQueryBuilder("room")
        .leftJoinAndSelect("room.owner", "owner")
        .andWhere("room.status = 'active'")
        // Unlike businesses (which degrade gracefully to a text-only card
        // when photo-less), a room/apartment with no photos is excluded
        // from public listings entirely rather than shown without one.
        // `images` is a `simple-array` column, stored as a comma-joined
        // string, so an empty array persists as ''.
        .andWhere("room.images IS NOT NULL AND room.images != ''");

    // Area filter
    if (
      filters?.location &&
      filters.location !== "Near Me" &&
      !opts?.skipAreaFilter
    ) {
      query.andWhere(
        "room.location->>'area' = :location",
        {
          location: filters.location,
        }
      );
    }

    // Price
    if (filters?.filter) {
      switch (filters.filter) {
        case "0-2000":
          query.andWhere(
            "room.price BETWEEN :min AND :max",
            {
              min: 0,
              max: 2000,
            }
          );
          break;

        case "2000-4000":
          query.andWhere(
            "room.price BETWEEN :min AND :max",
            {
              min: 2000,
              max: 4000,
            }
          );
          break;

        case "4000-6000":
          query.andWhere(
            "room.price BETWEEN :min AND :max",
            {
              min: 4000,
              max: 6000,
            }
          );
          break;

        case "6000-10000":
          query.andWhere(
            "room.price BETWEEN :min AND :max",
            {
              min: 6000,
              max: 10000,
            }
          );
          break;

        case "10000+":
          query.andWhere(
            "room.price >= :price",
            {
              price: 10000,
            }
          );
          break;
      }
    }

    // Tags
    // Amenities are stored as individual boolean columns on Room (not a
    // JSON "amenities" object), so tags filter directly on those columns.
    filters?.activeTags?.forEach((tag) => {
      switch (tag) {
        case "WiFi Included":
          query.andWhere("room.wifi = true");
          break;

        case "Parking":
          query.andWhere("room.parking = true");
          break;

        case "Furnished":
          query.andWhere("room.furnished = true");
          break;

        case "Pet Friendly":
          query.andWhere("room.petsAllowed = true");
          break;
      }
    });

    return query;
  };

  // Shared by both the "Near Me" path and the province/region fallback
  // below — probes the escalating radius levels around (lat, lng) and
  // returns a query sorted by real distance. `opts` is forwarded to
  // buildQuery() so the fallback can skip the (already-empty) area filter.
  const radiusSearch = async (opts?: { skipAreaFilter?: boolean }) => {
    const distanceExpr = haversineKmExpr("room.location");

    // A room without coordinates can't be measured, so it's excluded from
    // the nearby/distance-sorted view entirely.
    const nearMeQuery = () =>
      buildQuery(opts)
        .andWhere("room.location->>'lat' IS NOT NULL")
        .andWhere("room.location->>'lng' IS NOT NULL")
        .setParameters({ lat: filters!.lat, lng: filters!.lng });

    const meta = await resolveNearbyRadius((radiusKm) => {
      const probe = nearMeQuery();
      if (radiusKm != null) {
        probe.andWhere(`${distanceExpr} <= :radiusKm`, { radiusKm });
      }
      return probe;
    });

    // Sort by real distance to the given coordinates at the DB level so
    // pagination doesn't require loading every matching row into memory.
    // Selected as an aliased column (rather than passed as a raw orderBy
    // expression) because TypeORM's join-aware orderBy parser chokes on
    // raw SQL containing nested parentheses.
    const query = nearMeQuery()
      .addSelect(distanceExpr, "distanceKm")
      .orderBy("distanceKm", "ASC");

    if (meta.radiusKm != null) {
      query.andWhere(`${distanceExpr} <= :radiusKm`, {
        radiusKm: meta.radiusKm,
      });
    }

    return { query, meta };
  };

  const hasCoords = filters?.lat != null && filters?.lng != null;
  const hasNamedLocation = Boolean(
    filters?.location && filters.location !== "Near Me",
  );

  let finalQuery: ReturnType<typeof buildQuery>;
  let nearbyMeta: NearbyMeta | undefined;

  if (isNearMe) {
    ({ query: finalQuery, meta: nearbyMeta } = await radiusSearch());
  } else if (hasNamedLocation && hasCoords) {
    // A typed location (e.g. a suburb the user picked from the address
    // autocomplete) is matched by exact area name — but geocoding a
    // *province* (e.g. "Gauteng") resolves to a coordinate whose area name
    // is the province itself, which no listing's `location.area` (always a
    // specific suburb/town) will ever equal. Rather than surface that as
    // "no results", fall back to the same radius search "Near Me" uses,
    // centred on the geocoded point, once the exact match has actually
    // come up empty.
    const exactMatchCount = await buildQuery().getCount();

    if (exactMatchCount > 0) {
      finalQuery = buildQuery().orderBy("room.id", "DESC");
    } else {
      ({ query: finalQuery, meta: nearbyMeta } = await radiusSearch({
        skipAreaFilter: true,
      }));
    }
  } else {
    finalQuery = buildQuery().orderBy("room.id", "DESC");
  }

  const { page, limit, skip } = parsePaginationParams(
    pagination?.page,
    pagination?.limit,
  );

  finalQuery.skip(skip).take(limit);

  const [rooms, total] = await finalQuery.getManyAndCount();

  return paginate(rooms.map(withOwnerVerified), total, page, limit, nearbyMeta);
}

  async findOne(id: number) {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: { owner: true },
    });

    return room ? withOwnerVerified(room) : room;
  }

  // Raw, mutable fetch (owner intact) for callers that need to check
  // ownership before mutating — mirrors Business/Gig's findOneRaw.
  private async findOneRaw(id: number) {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: { owner: true },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }

    return room;
  }

  // Live Google Places photo for a listing with no photos of its own — see
  // BusinessService.getGooglePhotoBytes's identical logic/reasoning.
  async getGooglePhotoBytes(id: number): Promise<{ body: Buffer; contentType: string } | null> {
    if (!this.googlePlacesService.isConfigured) return null;

    const room = await this.findOneRaw(id);
    if (room.images.length > 0) return null;

    const isStale =
      !room.googlePhotoCheckedAt ||
      Date.now() - room.googlePhotoCheckedAt.getTime() > GOOGLE_PHOTO_CACHE_MS;

    if (isStale) {
      const result = await this.googlePlacesService.findPlacePhoto({
        name: room.name,
        address: room.location?.address ?? room.location?.area ?? null,
        lat: room.location?.lat ?? null,
        lng: room.location?.lng ?? null,
      });
      room.googlePlaceId = result.placeId;
      room.googlePhotoRef = result.photoName;
      room.googlePhotoCheckedAt = new Date();
      await this.roomRepository.save(room);
    }

    if (!room.googlePhotoRef) return null;
    return this.googlePlacesService.fetchPhotoBytes(room.googlePhotoRef);
  }

  async update(id: number, updateRoomDto: UpdateRoomDto, userId: number) {
    const room = await this.findOneRaw(id);

    if (room.owner.id !== userId) {
      throw new ForbiddenException("You can only edit your own listing.");
    }

    await this.roomRepository.update(id, updateRoomDto);

    return this.findOne(id);
  }

  async updateStatus(
    id: number,
    status: "active" | "pending_review" | "suspended",
  ) {
    await this.roomRepository.update(id, { status });

    return this.findOne(id);
  }

  // Lightweight, unauthenticated engagement counters (LinkedIn-style "N
  // people viewed this"), so an owner can see whether their listing is
  // getting attention. .increment() issues an atomic UPDATE ... SET col =
  // col + 1 rather than a read-modify-write, so concurrent views/clicks
  // can't clobber each other. Not excluded for the owner's own visits —
  // the frontend skips firing these for the owner instead (see
  // features/analytics/services/analytics.service.ts), same "best effort,
  // not security-critical" tolerance as the isOwner checks elsewhere.
  async recordView(id: number) {
    await this.roomRepository.increment({ id }, "viewCount", 1);
  }

  async recordContactClick(id: number) {
    await this.roomRepository.increment({ id }, "contactClickCount", 1);
  }

  async remove(id: number, userId: number) {
    const room = await this.findOneRaw(id);

    if (room.owner.id !== userId) {
      throw new ForbiddenException("You can only delete your own listing.");
    }

    await this.roomRepository.delete(id);

    return {
      message: 'Room deleted successfully',
    };
  }

  // Real submission behind what was previously a frontend-only mock (the
  // form saved nothing anywhere — see ReviewSection.tsx). Identity comes
  // from the authenticated account, not a free-text name field, so a
  // review can't be posted as someone else.
  async addReview(roomId: number, userId: number, dto: CreateReviewDto) {
    const room = await this.findOneRaw(roomId);

    if (room.owner.id === userId) {
      throw new ForbiddenException("You can't review your own listing.");
    }

    const reviewer = await this.userRepository.findOne({ where: { id: userId } });

    if (!reviewer) {
      throw new NotFoundException("User not found.");
    }

    const existingReviews = room.reviews ?? [];

    if (existingReviews.some((r) => r.reviewerId === userId)) {
      throw new ConflictException("You've already reviewed this listing.");
    }

    const review: RoomReview = {
      id: randomUUID(),
      reviewerId: reviewer.id,
      name: `${reviewer.firstName} ${reviewer.surname}`.trim(),
      rating: dto.rating,
      comment: dto.comment,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    await this.roomRepository.update(roomId, {
      reviews: [...existingReviews, review],
    });

    notifyAdminReviewNeedsApproval({
      roomId: room.id,
      roomName: room.name,
      reviewerName: review.name,
      rating: review.rating,
      comment: review.comment,
    }).catch(() => {});

    return { message: "Review submitted — pending approval." };
  }

  // Admin-only (see AdminService/AdminController) — every room's reviews
  // live in that room's own JSON column, so "all pending reviews" means
  // scanning every room rather than a single indexed query. Fine at this
  // scale; a dedicated Review table would be the move if that stops being
  // true.
  async getPendingReviews() {
    const rooms = await this.roomRepository.find({
      select: { id: true, name: true, reviews: true },
    });

    const pending: { roomId: number; roomName: string; review: RoomReview }[] = [];

    for (const room of rooms) {
      for (const review of room.reviews ?? []) {
        if (review.status === "pending") {
          pending.push({ roomId: room.id, roomName: room.name, review });
        }
      }
    }

    return pending;
  }

  async setReviewStatus(
    roomId: number,
    reviewId: string,
    status: "approved" | "rejected",
  ) {
    const room = await this.findOneRaw(roomId);
    const reviews = room.reviews ?? [];
    const index = reviews.findIndex((r) => r.id === reviewId);

    if (index === -1) {
      throw new NotFoundException("Review not found.");
    }

    reviews[index] = { ...reviews[index], status };

    const approved = reviews.filter((r) => r.status === "approved");
    const reviewCount = approved.length;
    const rating =
      reviewCount > 0
        ? approved.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;

    await this.roomRepository.update(roomId, { reviews, reviewCount, rating });

    return { message: `Review ${status}.` };
  }

  // Shared by searchForAI/countForAI. bedrooms is ">=" rather than the
  // exact match the structured filter UI would use — in a chat context
  // "2 bedroom place" more often means "at least 2" than "exactly 2", and
  // an exact match risks an empty result for a perfectly reasonable ask.
  private buildAIQuery(filters: {
    location?: string;
    maxPrice?: number;
    bedrooms?: number;
    category?: string;
    furnished?: boolean;
    wifi?: boolean;
    parking?: boolean;
    petsAllowed?: boolean;
  }) {
    const query = this.roomRepository
      .createQueryBuilder("room")
      .andWhere("room.status = 'active'");

    if (filters.location) {
      query.andWhere(
        "LOWER(room.location->>'area') LIKE LOWER(:location)",
        { location: `%${filters.location}%` },
      );
    }

    if (filters.maxPrice != null) {
      query.andWhere("room.price <= :maxPrice", { maxPrice: filters.maxPrice });
    }

    if (filters.bedrooms != null) {
      query.andWhere("room.bedrooms >= :bedrooms", { bedrooms: filters.bedrooms });
    }

    if (filters.category) {
      query.andWhere("LOWER(room.category) LIKE LOWER(:category)", {
        category: `%${filters.category}%`,
      });
    }

    if (filters.furnished) query.andWhere("room.furnished = true");
    if (filters.wifi) query.andWhere("room.wifi = true");
    if (filters.parking) query.andWhere("room.parking = true");
    if (filters.petsAllowed) query.andWhere("room.petsAllowed = true");

    return query;
  }

  async searchForAI(filters: {
    location?: string;
    maxPrice?: number;
    bedrooms?: number;
    category?: string;
    furnished?: boolean;
    wifi?: boolean;
    parking?: boolean;
    petsAllowed?: boolean;
  }) {
    return this.buildAIQuery(filters)
      .orderBy("room.price", "ASC")
      .limit(10)
      .getMany();
  }

  async countForAI(filters: {
    location?: string;
    maxPrice?: number;
    bedrooms?: number;
    category?: string;
    furnished?: boolean;
    wifi?: boolean;
    parking?: boolean;
    petsAllowed?: boolean;
  }) {
    return this.buildAIQuery(filters).getCount();
  }
}