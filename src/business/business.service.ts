import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "./entities/business.entity";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { randomUUID } from "crypto";
import { User } from "src/users/entities/user.entity";
import { BusinessCategoryService } from "src/business-category/business-category.service";
import { parsePaginationParams, paginate } from "src/common/pagination/pagination.util";
import { haversineKmExpr, resolveNearbyRadius, NearbyMeta } from "src/common/geo/geo.util";
import { notifyAdminListingNeedsReview } from "src/common/notifications/admin-notify.helper";

// Exposes only whether the owner is verified, never their raw email/phone.
// Phone-only, not email-or-phone: email verification is free and
// unlimited (no real-world cost to faking many of them), while a South
// African SIM is RICA-registered against an ID document — a phone number
// is the stronger signal that a real, accountable person is behind the
// listing, which is the whole point of showing this badge.
function withOwnerVerified(business: Business) {
  const { owner, ...rest } = business;
  return {
    ...rest,
    ownerId: owner?.id,
    ownerVerified: Boolean(owner?.phoneVerified),
  };
}

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,

     @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly businessCategoryService: BusinessCategoryService,
  ) {}

 async create(
  dto: CreateBusinessDto,
  userId: number,
) {
  const owner = await this.userRepository.findOne({
    where: { id: userId },
  });

  if (!owner) {
    throw new Error("User not found");
  }

  if (!owner.emailVerified && !owner.phoneVerified) {
    throw new ForbiddenException(
      "Please verify your email or phone number before creating a listing.",
    );
  }

  const category = await this.businessCategoryService.findCategoryBySlug(
    dto.categorySlug,
  );

  const subcategory = dto.subcategorySlug
    ? await this.businessCategoryService.findSubcategoryBySlug(
        category.id,
        dto.subcategorySlug,
      )
    : null;

  this.assertLocationRequirements(dto.businessType, dto.location);
  this.assertWhatsAppRequirements(dto.supportsWhatsAppOrder, dto.whatsappNumber);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentDuplicateQuery = this.businessRepository
    .createQueryBuilder("business")
    .where("business.ownerId = :ownerId", { ownerId: owner.id })
    .andWhere("LOWER(business.name) = LOWER(:name)", { name: dto.name })
    .andWhere("business.createdAt >= :since", { since: fiveMinutesAgo });

  if (dto.location?.area) {
    recentDuplicateQuery.andWhere("business.location->>'area' = :area", {
      area: dto.location.area,
    });
  }

  const recentDuplicate = await recentDuplicateQuery.getOne();

  if (recentDuplicate) {
    throw new ConflictException(
      "You already have a very similar listing — did you mean to submit twice?",
    );
  }

  const nearDuplicateQuery = this.businessRepository
    .createQueryBuilder("business")
    .where("business.ownerId != :ownerId", { ownerId: owner.id })
    .andWhere("business.status = 'active'")
    .andWhere("LOWER(business.name) = LOWER(:name)", { name: dto.name.trim() })
    .andWhere("business.categoryId = :categoryId", { categoryId: category.id });

  if (dto.location?.area) {
    nearDuplicateQuery.andWhere("business.location->>'area' = :area", {
      area: dto.location.area,
    });
  }

  if (dto.priceRange) {
    nearDuplicateQuery.andWhere("business.priceRange = :priceRange", {
      priceRange: dto.priceRange,
    });
  }

  const isNearDuplicateOfOtherOwner = await nearDuplicateQuery.getExists();

  const business = this.businessRepository.create({
    externalId: randomUUID(),

    owner,

    name: dto.name,
    credential: dto.credential ?? null,
    category,
    subcategory,
    businessType: dto.businessType,
    description: dto.description,

    location: dto.location ?? null,

    images: dto.images ?? [],
    videos: dto.videos ?? [],

    operatingHours:
      dto.operatingHours ?? {
        monday: "Closed",
        tuesday: "Closed",
        wednesday: "Closed",
        thursday: "Closed",
        friday: "Closed",
        saturday: "Closed",
        sunday: "Closed",
      },

    supportsDelivery: dto.supportsDelivery ?? false,
    supportsWhatsAppOrder: dto.supportsWhatsAppOrder ?? false,
    whatsappNumber: dto.whatsappNumber ?? null,
    phoneNumber: dto.phoneNumber,
    priceRange: dto.priceRange ?? null,

    rating: 0,

    reviewCount: 0,
    reportCount: 0,
    status: isNearDuplicateOfOtherOwner ? "pending_review" : "active",
  });

  const saved = await this.businessRepository.save(business);

  if (isNearDuplicateOfOtherOwner) {
    notifyAdminListingNeedsReview({
      listingType: "business",
      listingId: saved.id,
      listingName: saved.name,
      reason:
        "Looks like a near-duplicate of another owner's existing listing (same name, category, and area).",
    }).catch(() => {});
  }

  return withOwnerVerified(saved);
}

async findAll(
  filters?: {
    location?: string;
    categorySlug?: string;
    subcategorySlug?: string;
    search?: string;
    openNow?: boolean;
    deliveryAvailable?: boolean;
    onlineOnly?: boolean;
    nearby?: boolean;
    highlyRated?: boolean;
    priceRange?: string;
    lat?: number;
    lng?: number;
  },
  pagination?: {
    page?: number | string;
    limit?: number | string;
  },
) {
  // Distance sort is meaningless for online-only results (they have no
  // location, and nearMeQuery below excludes businessType 'online'
  // outright) — so an explicit onlineOnly filter opts out of it, rather
  // than silently ANDing with a condition it can never satisfy.
  const isNearMe =
    filters?.lat != null &&
    filters?.lng != null &&
    !filters?.onlineOnly &&
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
      this.businessRepository.createQueryBuilder("business")
        .leftJoinAndSelect("business.category", "category")
        .leftJoinAndSelect("business.subcategory", "subcategory")
        .leftJoinAndSelect("business.owner", "owner")
        .andWhere("business.status = 'active'");

    // Explicit "Nearby" filter toggle (independent of automatic geolocation
    // sorting below) — still restricted to physical businesses only.
    if (filters?.nearby) {
      query.andWhere("business.businessType = 'physical'");
    }

    // Area filter (only if user selected a location)
    if (
      filters?.location &&
      filters.location !== "Near Me" &&
      !opts?.skipAreaFilter
    ) {
      query.andWhere(
        "business.location->>'area' = :location",
        {
          location: filters.location,
        }
      );
    }

    if (filters?.categorySlug) {
      query.andWhere("category.slug = :categorySlug", {
        categorySlug: filters.categorySlug,
      });
    }

    if (filters?.subcategorySlug) {
      query.andWhere("subcategory.slug = :subcategorySlug", {
        subcategorySlug: filters.subcategorySlug,
      });
    }

    if (filters?.search) {
      query.andWhere("LOWER(business.name) LIKE LOWER(:search)", {
        search: `%${filters.search}%`,
      });
    }

    if (filters?.deliveryAvailable) {
      query.andWhere("business.supportsDelivery = true");
    }

    if (filters?.onlineOnly) {
      query.andWhere("business.businessType = 'online'");
    }

    if (filters?.highlyRated) {
      query.andWhere("business.rating >= 4");
    }

    if (filters?.priceRange) {
      query.andWhere("business.priceRange = :priceRange", {
        priceRange: filters.priceRange,
      });
    }

    if (filters?.openNow) {
      // Online businesses are always "available". Physical businesses are
      // open now if today's operatingHours entry isn't "Closed" and the
      // current time falls within its "HH:MM - HH:MM" range.
      query.andWhere(
        `(
          business."businessType" = 'online'
          OR (
            business."operatingHours" ->> lower(to_char(now(), 'FMDay')) IS NOT NULL
            AND business."operatingHours" ->> lower(to_char(now(), 'FMDay')) <> 'Closed'
            AND to_char(now(), 'HH24:MI') BETWEEN
              split_part(business."operatingHours" ->> lower(to_char(now(), 'FMDay')), ' - ', 1)
              AND split_part(business."operatingHours" ->> lower(to_char(now(), 'FMDay')), ' - ', 2)
          )
        )`,
      );
    }

    return query;
  };

  // Shared by both the "Near Me" path and the province/region fallback
  // below — probes the escalating radius levels around (lat, lng) and
  // returns a query sorted by real distance. `opts` is forwarded to
  // buildQuery() so the fallback can skip the (already-empty) area filter.
  const radiusSearch = async (opts?: { skipAreaFilter?: boolean }) => {
    const distanceExpr = haversineKmExpr("business.location");

    // Online businesses never appear in nearby/distance-sorted results, and
    // a business without coordinates can't be measured at all.
    const nearMeQuery = () =>
      buildQuery(opts)
        .andWhere("business.businessType != 'online'")
        .andWhere("business.location->>'lat' IS NOT NULL")
        .andWhere("business.location->>'lng' IS NOT NULL")
        .setParameters({ lat: filters!.lat, lng: filters!.lng });

    const meta = await resolveNearbyRadius((radiusKm) => {
      const probe = nearMeQuery();
      if (radiusKm != null) {
        probe.andWhere(`${distanceExpr} <= :radiusKm`, { radiusKm });
      }
      return probe;
    });

    // The distance expression is registered via addSelect + orderBy(alias)
    // rather than a raw expression directly in orderBy(), because TypeORM's
    // alias parser can't resolve a parenthesized raw ORDER BY expression once
    // joins (category/subcategory below) are involved.
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
  } else if (hasNamedLocation && hasCoords && !filters?.onlineOnly) {
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
      finalQuery = buildQuery().orderBy("business.id", "DESC");
    } else {
      ({ query: finalQuery, meta: nearbyMeta } = await radiusSearch({
        skipAreaFilter: true,
      }));
    }
  } else {
    finalQuery = buildQuery().orderBy("business.id", "DESC");
  }

  const { page, limit, skip } = parsePaginationParams(
    pagination?.page,
    pagination?.limit,
  );

  finalQuery.skip(skip).take(limit);

  const [businesses, total] = await finalQuery.getManyAndCount();

  return paginate(businesses.map(withOwnerVerified), total, page, limit, nearbyMeta);
}

  // Internal fetch returning the raw, mutable entity — used wherever the
  // result is passed back into save()/remove() rather than sent to a client.
  private async findOneRaw(id: number) {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: { category: true, subcategory: true, owner: true },
    });

    if (!business) {
      throw new NotFoundException(`Business with id ${id} not found`);
    }

    return business;
  }

  async findOne(id: number) {
    return withOwnerVerified(await this.findOneRaw(id));
  }

  async update(id: number, dto: UpdateBusinessDto, userId: number) {
    const business = await this.findOneRaw(id);

    if (business.owner.id !== userId) {
      throw new ForbiddenException("You can only edit your own listing.");
    }

    if (dto.categorySlug) {
      business.category = await this.businessCategoryService.findCategoryBySlug(
        dto.categorySlug,
      );

      // A previously-set subcategory may belong to the old category — clear
      // it unless a new subcategory is also given in this same update.
      if (!dto.subcategorySlug) {
        business.subcategory = null;
      }
    }

    if (dto.subcategorySlug) {
      business.subcategory = await this.businessCategoryService.findSubcategoryBySlug(
        business.category.id,
        dto.subcategorySlug,
      );
    }

    const businessType = dto.businessType ?? business.businessType;
    const location = dto.location ?? business.location;
    this.assertLocationRequirements(businessType, location);

    const supportsWhatsAppOrder =
      dto.supportsWhatsAppOrder ?? business.supportsWhatsAppOrder;
    const whatsappNumber = dto.whatsappNumber ?? business.whatsappNumber;
    this.assertWhatsAppRequirements(supportsWhatsAppOrder, whatsappNumber);

    const { categorySlug, subcategorySlug, ...updatableFields } = dto;
    Object.assign(business, updatableFields);

    return withOwnerVerified(await this.businessRepository.save(business));
  }

  async remove(id: number, userId: number) {
    const business = await this.findOneRaw(id);

    if (business.owner.id !== userId) {
      throw new ForbiddenException("You can only delete your own listing.");
    }

    return await this.businessRepository.remove(business);
  }

  async updateStatus(
    id: number,
    status: "active" | "pending_review" | "suspended",
  ) {
    const business = await this.findOneRaw(id);
    business.status = status;
    return withOwnerVerified(await this.businessRepository.save(business));
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
    await this.businessRepository.increment({ id }, "viewCount", 1);
  }

  async recordContactClick(id: number) {
    await this.businessRepository.increment({ id }, "contactClickCount", 1);
  }

  private assertLocationRequirements(
    businessType: "physical" | "online",
    location?: {
      address?: string;
      area?: string;
      lat?: number;
      lng?: number;
    } | null,
  ) {
    if (businessType !== "physical") {
      return;
    }

    if (
      !location?.address ||
      !location?.area ||
      location?.lat == null ||
      location?.lng == null
    ) {
      throw new BadRequestException(
        "Physical businesses require a full address with coordinates (address, area, lat, lng).",
      );
    }
  }

  private assertWhatsAppRequirements(
    supportsWhatsAppOrder?: boolean,
    whatsappNumber?: string | null,
  ) {
    if (supportsWhatsAppOrder && !whatsappNumber) {
      throw new BadRequestException(
        "whatsappNumber is required when supportsWhatsAppOrder is enabled.",
      );
    }
  }

  // Shared by searchForAI/countForAI — the AI only ever has free text to
  // work with (no slugs), so category matching stays a LIKE against the
  // human-readable category/subcategory names rather than the slug-based
  // exact match findAll() uses for the structured filter UI.
  private buildAIQuery(filters: {
    location?: string;
    category?: string;
    highlyRated?: boolean;
    deliveryAvailable?: boolean;
    onlineOnly?: boolean;
    openNow?: boolean;
    priceRange?: string;
  }) {
    const query = this.businessRepository
      .createQueryBuilder("business")
      .leftJoinAndSelect("business.category", "category")
      .leftJoinAndSelect("business.subcategory", "subcategory")
      .andWhere("business.status = 'active'");

    if (filters.location) {
      query.andWhere(
        "LOWER(business.location->>'area') LIKE LOWER(:location)",
        { location: `%${filters.location}%` },
      );
    }

    if (filters.category) {
      query.andWhere(
        "(LOWER(category.name) LIKE LOWER(:category) OR LOWER(subcategory.name) LIKE LOWER(:category))",
        { category: `%${filters.category}%` },
      );
    }

    if (filters.highlyRated) {
      query.andWhere("business.rating >= 4");
    }

    if (filters.deliveryAvailable) {
      query.andWhere("business.supportsDelivery = true");
    }

    if (filters.onlineOnly) {
      query.andWhere("business.businessType = 'online'");
    }

    if (filters.priceRange) {
      query.andWhere("business.priceRange = :priceRange", {
        priceRange: filters.priceRange,
      });
    }

    if (filters.openNow) {
      query.andWhere(
        `(
          business."businessType" = 'online'
          OR (
            business."operatingHours" ->> lower(to_char(now(), 'FMDay')) IS NOT NULL
            AND business."operatingHours" ->> lower(to_char(now(), 'FMDay')) <> 'Closed'
            AND to_char(now(), 'HH24:MI') BETWEEN
              split_part(business."operatingHours" ->> lower(to_char(now(), 'FMDay')), ' - ', 1)
              AND split_part(business."operatingHours" ->> lower(to_char(now(), 'FMDay')), ' - ', 2)
          )
        )`,
      );
    }

    return query;
  }

  async searchForAI(filters: {
    location?: string;
    category?: string;
    highlyRated?: boolean;
    deliveryAvailable?: boolean;
    onlineOnly?: boolean;
    openNow?: boolean;
    priceRange?: string;
  }) {
    return this.buildAIQuery(filters)
      .orderBy("business.rating", "DESC")
      .limit(10)
      .getMany();
  }

  async countForAI(filters: {
    location?: string;
    category?: string;
    highlyRated?: boolean;
    deliveryAvailable?: boolean;
    onlineOnly?: boolean;
    openNow?: boolean;
    priceRange?: string;
  }) {
    return this.buildAIQuery(filters).getCount();
  }
}
