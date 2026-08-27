/**
 * One-off ingestion script: pulls real local-business listings for
 * Braamfontein, Johannesburg from OpenStreetMap and inserts them as
 * Business rows. See scripts/lib/osm-seed.ts for the shared logic (tag
 * mapping, hours parsing, owner/category handling) and its own docblock
 * for full details — this file just picks the area.
 *
 * Usage (from the-cosmopolitan-api/):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-osm-braamfontein.ts
 *
 * Re-running is safe — see osm-seed.ts.
 */
import 'dotenv/config';
import { seedOsmArea } from './lib/osm-seed';

// Braamfontein bounding box (south, west, north, east), from Nominatim.
const BBOX = '-26.2123008,28.0161353,-26.1723008,28.0561353';

seedOsmArea({ bbox: BBOX, areaName: 'Braamfontein', cityName: 'Johannesburg' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
