import { SelectQueryBuilder } from "typeorm";

// Escalation levels used by resolveNearbyRadius() below: try the tightest
// radius first, and only widen if it comes back empty. `null` means "no
// cap" — always guaranteed to return whatever matches the other filters.
export const NEARBY_RADIUS_LEVELS_KM: (number | null)[] = [15, 50, null];

export interface NearbyMeta {
  radiusKm: number | null;
  expanded: boolean;
}

// Real great-circle distance (km) between (:lat, :lng) and the lat/lng
// stored on a JSONB `location` column, e.g. haversineKmExpr("business.location").
// The least/greatest clamp guards against acos() receiving something
// infinitesimally outside [-1, 1] from floating-point rounding, which would
// otherwise return NaN and silently drop rows from every WHERE/ORDER BY
// that touches it.
export function haversineKmExpr(locationColumn: string): string {
  return `(6371 * acos(least(1, greatest(-1,
    cos(radians(:lat)) * cos(radians((${locationColumn}->>'lat')::float)) *
      cos(radians((${locationColumn}->>'lng')::float) - radians(:lng)) +
    sin(radians(:lat)) * sin(radians((${locationColumn}->>'lat')::float))
  ))))`;
}

// Finds the narrowest radius level that still returns at least one result,
// so "nearby" defaults to a tight radius but never comes back empty just
// because nothing happens to be within 15km. `probe` must return a fresh
// (or cloned) query builder with the radius WHERE applied for the given
// level — the caller owns building the rest of the filters.
export async function resolveNearbyRadius(
  probe: (radiusKm: number | null) => SelectQueryBuilder<any>,
): Promise<NearbyMeta> {
  for (let i = 0; i < NEARBY_RADIUS_LEVELS_KM.length; i++) {
    const radiusKm = NEARBY_RADIUS_LEVELS_KM[i];
    const isLastLevel = i === NEARBY_RADIUS_LEVELS_KM.length - 1;

    const count = await probe(radiusKm).getCount();

    if (count > 0 || isLastLevel) {
      return { radiusKm, expanded: i > 0 };
    }
  }

  // Unreachable — the loop always returns on its last iteration — but keeps
  // the function total for TypeScript.
  return { radiusKm: null, expanded: true };
}
