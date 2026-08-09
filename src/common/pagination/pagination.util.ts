import { NearbyMeta } from "src/common/geo/geo.util";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
  // Present only when results were sorted/filtered by GPS proximity —
  // tells the client which radius was actually used and whether it had to
  // widen past the default because nothing closer matched.
  nearby?: NearbyMeta;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePaginationParams(
  page?: string | number,
  limit?: string | number,
): PaginationParams {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const safePage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.floor(parsedPage)
      : DEFAULT_PAGE;

  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.floor(parsedLimit)
      : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  nearby?: NearbyMeta,
): Paginated<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    ...(nearby ? { nearby } : {}),
  };
}
