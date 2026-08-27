/**
 * One-off ingestion script: pulls real local-business listings for
 * Cosmo City, Johannesburg from OpenStreetMap and inserts them as Business
 * rows. See scripts/lib/osm-seed.ts for the shared logic and its own
 * docblock for full details — this file just picks the area.
 *
 * Cosmo City has genuinely thin OSM coverage (~11-14 named businesses as of
 * this writing — mostly the Cosmo Mall/Cosmo Junction anchor tenants, fuel
 * stations, and a handful of independent shops). The bounding box below is
 * deliberately the *tight* one from Nominatim's own suburb node, not a
 * widened one — a wider box pulls in Fourways/Northriding businesses
 * (upmarket restaurants, "Northlands Corner" mall, etc.) that are a
 * different area entirely and would mislabel their location as "Cosmo
 * City". Real coverage stays sparse here until a better data source (open
 * data portal, manual entry) fills it in — don't widen this box to make
 * the count look better.
 *
 * Usage (from the-cosmopolitan-api/):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-osm-cosmo-city.ts
 *
 * Re-running is safe — see osm-seed.ts.
 */
import 'dotenv/config';
import { seedOsmArea } from './lib/osm-seed';

// Cosmo City bounding box (south, west, north, east) — Nominatim's own
// boundingbox for the "Cosmo City" suburb node, reordered. Kept tight on
// purpose; see the docblock above.
const BBOX = '-26.0419350,27.9107566,-26.0019350,27.9507566';

seedOsmArea({ bbox: BBOX, areaName: 'Cosmo City', cityName: 'Johannesburg' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
