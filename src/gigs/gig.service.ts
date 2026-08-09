import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Gig } from "./entities/gig.entity";
import { CreateGigDto } from "./dto/create-gig.dto";
import { UpdateGigDto } from "./dto/update-gig.dto";
import { User } from "src/users/entities/user.entity";
import { BusinessCategoryService } from "src/business-category/business-category.service";
import { parsePaginationParams, paginate } from "src/common/pagination/pagination.util";
import { haversineKmExpr, resolveNearbyRadius, NearbyMeta } from "src/common/geo/geo.util";

// How long a post stays visible after creation, based on how urgent the
// poster said it was — the mechanism that keeps the board fresh without a
// cron job (findAll() just filters expiresAt > now()).
const URGENCY_TTL_MS: Record<CreateGigDto["urgency"], number> = {
  today: 24 * 60 * 60 * 1000,
  this_week: 7 * 24 * 60 * 60 * 1000,
  flexible: 30 * 24 * 60 * 60 * 1000,
};

// Exposes only whether the owner is verified, never their raw email/phone —
// same privacy shape as Room/Business.
// ownerId is included (unlike Room/Business, which strip it entirely) so
// the frontend can show the "Mark as filled" action only to the poster —
// it's an opaque integer, not PII, so exposing it doesn't leak anything
// email/phone would.
// Phone-only, not email-or-phone — see the identical note in
// business.service.ts's withOwnerVerified for why.
function withOwnerVerified(gig: Gig) {
  const { owner, ...rest } = gig;
  return {
    ...rest,
    ownerId: owner?.id,
    ownerVerified: Boolean(owner?.phoneVerified),
  };
}

@Injectable()
export class GigService {
  constructor(
    @InjectRepository(Gig)
    private readonly gigRepository: Repository<Gig>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly businessCategoryService: BusinessCategoryService,
  ) {}

  async create(dto: CreateGigDto, userId: number) {
    const owner = await this.userRepository.findOne({ where: { id: userId } });

    if (!owner) {
      throw new Error("User not found");
    }

    if (!owner.emailVerified && !owner.phoneVerified) {
      throw new ForbiddenException(
        "Please verify your email or phone number before posting.",
      );
    }

    const category = dto.categorySlug
      ? await this.businessCategoryService.findCategoryBySlug(dto.categorySlug)
      : null;

    const subcategory =
      dto.subcategorySlug && category
        ? await this.businessCategoryService.findSubcategoryBySlug(
            category.id,
            dto.subcategorySlug,
          )
        : null;

    // Lighter than the Room/Business duplicate guard — gigs are meant to be
    // posted often (a new "today" task every day is normal), so this only
    // catches an accidental double-submit of the exact same post.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentDuplicate = await this.gigRepository
      .createQueryBuilder("gig")
      .where("gig.ownerId = :ownerId", { ownerId: owner.id })
      .andWhere("LOWER(gig.title) = LOWER(:title)", { title: dto.title })
      .andWhere("gig.createdAt >= :since", { since: fiveMinutesAgo })
      .getExists();

    if (recentDuplicate) {
      throw new BadRequestException(
        "You already posted this — did you mean to submit twice?",
      );
    }

    const gig = this.gigRepository.create({
      owner,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      category,
      subcategory,
      price: dto.price ?? null,
      priceType: dto.priceType ?? "negotiable",
      urgency: dto.urgency,
      expiresAt: new Date(Date.now() + URGENCY_TTL_MS[dto.urgency]),
      location: dto.location,
      whatsappNumber: dto.whatsappNumber,
      reportCount: 0,
      status: "active",
    });

    return withOwnerVerified(await this.gigRepository.save(gig));
  }

  async findAll(
    filters?: {
      type?: "need_help" | "offering_work";
      categorySlug?: string;
      subcategorySlug?: string;
      urgency?: "today" | "this_week" | "flexible";
      location?: string;
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
      (!filters.location || filters.location === "Near Me");

    // Every gig, near-me or not, only shows up while it's actually live —
    // this is the whole expiry mechanism, no cron involved.
    // `skipAreaFilter` lets the province/region fallback below re-run every
    // other filter without the exact-area match that's already been proven
    // empty.
    const buildQuery = (opts?: { skipAreaFilter?: boolean }) => {
      const query = this.gigRepository
        .createQueryBuilder("gig")
        .leftJoinAndSelect("gig.category", "category")
        .leftJoinAndSelect("gig.subcategory", "subcategory")
        .leftJoinAndSelect("gig.owner", "owner")
        .andWhere("gig.status = 'active'")
        .andWhere("gig.expiresAt > :now", { now: new Date() });

      if (filters?.type) {
        query.andWhere("gig.type = :type", { type: filters.type });
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

      if (filters?.urgency) {
        query.andWhere("gig.urgency = :urgency", { urgency: filters.urgency });
      }

      if (filters?.location && filters.location !== "Near Me" && !opts?.skipAreaFilter) {
        query.andWhere("gig.location->>'area' = :location", {
          location: filters.location,
        });
      }

      return query;
    };

    // Shared by both the "Near Me" path and the province/region fallback
    // below — probes the escalating radius levels around (lat, lng) and
    // returns a query sorted by real distance. `opts` is forwarded to
    // buildQuery() so the fallback can skip the (already-empty) area
    // filter.
    const radiusSearch = async (opts?: { skipAreaFilter?: boolean }) => {
      const distanceExpr = haversineKmExpr("gig.location");

      const nearMeQuery = () =>
        buildQuery(opts)
          .andWhere("gig.location->>'lat' IS NOT NULL")
          .andWhere("gig.location->>'lng' IS NOT NULL")
          .setParameters({ lat: filters!.lat, lng: filters!.lng });

      const meta = await resolveNearbyRadius((radiusKm) => {
        const probe = nearMeQuery();
        if (radiusKm != null) {
          probe.andWhere(`${distanceExpr} <= :radiusKm`, { radiusKm });
        }
        return probe;
      });

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
      // *province* (e.g. "Gauteng") resolves to a coordinate whose area
      // name is the province itself, which no listing's `location.area`
      // (always a specific suburb/town) will ever equal. Rather than
      // surface that as "no results", fall back to the same radius search
      // "Near Me" uses, centred on the geocoded point, once the exact
      // match has actually come up empty.
      const exactMatchCount = await buildQuery().getCount();

      if (exactMatchCount > 0) {
        finalQuery = buildQuery().orderBy("gig.createdAt", "DESC");
      } else {
        ({ query: finalQuery, meta: nearbyMeta } = await radiusSearch({
          skipAreaFilter: true,
        }));
      }
    } else {
      finalQuery = buildQuery().orderBy("gig.createdAt", "DESC");
    }

    const { page, limit, skip } = parsePaginationParams(
      pagination?.page,
      pagination?.limit,
    );

    finalQuery.skip(skip).take(limit);

    const [gigs, total] = await finalQuery.getManyAndCount();

    return paginate(gigs.map(withOwnerVerified), total, page, limit, nearbyMeta);
  }

  private async findOneRaw(id: number) {
    const gig = await this.gigRepository.findOne({
      where: { id },
      relations: { category: true, subcategory: true, owner: true },
    });

    if (!gig) {
      throw new NotFoundException(`Gig with id ${id} not found`);
    }

    return gig;
  }

  async findOne(id: number) {
    return withOwnerVerified(await this.findOneRaw(id));
  }

  // Full edit of the poster's own gig (title/description/price/location/
  // etc.) — separate from updateOwnStatus below, which only ever flips
  // active/filled. Re-derives expiresAt from urgency when urgency changes,
  // same TTL table create() uses, so editing "today" -> "flexible" actually
  // extends how long the post stays visible instead of leaving the old
  // short deadline in place.
  async update(id: number, dto: UpdateGigDto, userId: number) {
    const gig = await this.findOneRaw(id);

    if (gig.owner.id !== userId) {
      throw new ForbiddenException("You can only edit your own post.");
    }

    if (dto.categorySlug) {
      gig.category = await this.businessCategoryService.findCategoryBySlug(
        dto.categorySlug,
      );

      if (!dto.subcategorySlug) {
        gig.subcategory = null;
      }
    }

    if (dto.subcategorySlug) {
      gig.subcategory = await this.businessCategoryService.findSubcategoryBySlug(
        gig.category.id,
        dto.subcategorySlug,
      );
    }

    const { categorySlug, subcategorySlug, ...updatableFields } = dto;
    Object.assign(gig, updatableFields);

    if (dto.urgency) {
      gig.expiresAt = new Date(Date.now() + URGENCY_TTL_MS[dto.urgency]);
    }

    return withOwnerVerified(await this.gigRepository.save(gig));
  }

  // Lets the poster mark their own gig filled (or reopen it) — the one
  // status transition that's the user's own to make, unlike moderation
  // transitions (pending_review/suspended), which stay admin/report-driven.
  async updateOwnStatus(
    id: number,
    userId: number,
    status: "active" | "filled",
  ) {
    const gig = await this.findOneRaw(id);

    if (gig.owner.id !== userId) {
      throw new ForbiddenException("You can only update your own post.");
    }

    gig.status = status;

    return withOwnerVerified(await this.gigRepository.save(gig));
  }

  async remove(id: number, userId: number) {
    const gig = await this.findOneRaw(id);

    if (gig.owner.id !== userId) {
      throw new ForbiddenException("You can only delete your own post.");
    }

    return this.gigRepository.remove(gig);
  }

  // The admin-moderation counterpart to updateOwnStatus above — mirrors
  // Room/Business's identical updateStatus, called only from AdminService.
  async updateStatus(
    id: number,
    status: "active" | "pending_review" | "suspended",
  ) {
    await this.gigRepository.update(id, { status });

    return this.findOne(id);
  }

  // Lightweight, unauthenticated engagement counters (LinkedIn-style "N
  // people viewed this"), so an owner can see whether their post is getting
  // attention. .increment() issues an atomic UPDATE ... SET col = col + 1
  // rather than a read-modify-write, so concurrent views/clicks can't
  // clobber each other. Not excluded for the owner's own visits — the
  // frontend skips firing these for the owner instead (see
  // features/analytics/services/analytics.service.ts), same "best effort,
  // not security-critical" tolerance as the isOwner checks elsewhere.
  async recordView(id: number) {
    await this.gigRepository.increment({ id }, "viewCount", 1);
  }

  async recordContactClick(id: number) {
    await this.gigRepository.increment({ id }, "contactClickCount", 1);
  }

  // Shared by searchForAI/countForAI — mirrors Business/Room's AI search:
  // free-text category (matched against the human-readable category/
  // subcategory names, since the AI extracts words, not slugs) rather than
  // the slug-exact match findAll() uses for the structured filter UI.
  private buildAIQuery(filters: {
    location?: string;
    category?: string;
    type?: "need_help" | "offering_work";
  }) {
    const query = this.gigRepository
      .createQueryBuilder("gig")
      .leftJoinAndSelect("gig.category", "category")
      .leftJoinAndSelect("gig.subcategory", "subcategory")
      .andWhere("gig.status = 'active'")
      .andWhere("gig.expiresAt > :now", { now: new Date() });

    if (filters.location) {
      query.andWhere("LOWER(gig.location->>'area') LIKE LOWER(:location)", {
        location: `%${filters.location}%`,
      });
    }

    if (filters.category) {
      query.andWhere(
        "(LOWER(category.name) LIKE LOWER(:category) OR LOWER(subcategory.name) LIKE LOWER(:category))",
        { category: `%${filters.category}%` },
      );
    }

    if (filters.type) {
      query.andWhere("gig.type = :type", { type: filters.type });
    }

    return query;
  }

  async searchForAI(filters: {
    location?: string;
    category?: string;
    type?: "need_help" | "offering_work";
  }) {
    return this.buildAIQuery(filters)
      .orderBy("gig.createdAt", "DESC")
      .limit(10)
      .getMany();
  }

  async countForAI(filters: {
    location?: string;
    category?: string;
    type?: "need_help" | "offering_work";
  }) {
    return this.buildAIQuery(filters).getCount();
  }
}
