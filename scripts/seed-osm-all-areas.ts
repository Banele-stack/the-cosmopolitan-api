/**
 * Runs seedOsmArea() across a curated list of major South African areas —
 * one metro/suburb at a time, with pacing between Overpass calls. This is
 * NOT a country-wide bulk extract: the public Overpass API is a shared
 * community resource that doesn't handle (and its usage policy doesn't
 * really permit) a single query spanning all of South Africa — attempting
 * that gets you rate-limited or timed out, as happened repeatedly during
 * development of this pipeline. This script instead processes a real,
 * growing list of specific areas sequentially and safely.
 *
 * Coordinates are each area's real geocoded centroid (via Nominatim) plus a
 * fixed ~4km box around it — not Nominatim's own returned bounding box,
 * which for many of these came back either city-scale (way too broad, e.g.
 * "Sandton" resolved to most of northern Johannesburg) or a single building
 * (way too narrow, e.g. "Hatfield" resolved to one railway station). A
 * fixed buffer around a real, verified point is far more predictable.
 *
 * To add more areas: append to AREAS below (name + a real geocoded lat/lng
 * — check it isn't a wildly-scaled or wrong match first, same as here) and
 * re-run. Already-seeded businesses are skipped (see osm-seed.ts), so
 * re-running the whole list is always safe.
 *
 * Usage (from the-cosmopolitan-api/):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-osm-all-areas.ts
 */
import 'dotenv/config';
import { seedOsmArea } from './lib/osm-seed';

const BOX_DEGREES = 0.02; // ~4km box around each centroid.

interface AreaSeed {
  name: string;
  city: string;
  lat: number;
  lng: number;
}

// Already covered by their own dedicated scripts (kept separate since they
// were the original, hand-verified pilot areas) — not repeated here.
//   Braamfontein, Johannesburg — scripts/seed-osm-braamfontein.ts
//   Cosmo City, Johannesburg    — scripts/seed-osm-cosmo-city.ts
const AREAS: AreaSeed[] = [
  { name: 'Sandton', city: 'Johannesburg', lat: -26.1045525, lng: 28.0545147 },
  { name: 'Randburg', city: 'Johannesburg', lat: -26.0915852, lng: 28.0020276 },
  { name: 'Soweto', city: 'Johannesburg', lat: -26.2227778, lng: 27.89 },
  { name: 'Hatfield, Pretoria', city: 'Pretoria', lat: -25.7476402, lng: 28.2378733 },
  { name: 'Pretoria Central', city: 'Pretoria', lat: -25.7518426, lng: 28.1899743 },
  { name: 'Cape Town CBD', city: 'Cape Town', lat: -33.9252902, lng: 18.4185215 },
  { name: 'Khayelitsha', city: 'Cape Town', lat: -34.0405905, lng: 18.6674201 },
  { name: 'Stellenbosch', city: 'Stellenbosch', lat: -33.934444, lng: 18.869167 },
  { name: 'Durban Central', city: 'Durban', lat: -29.8574209, lng: 31.0222278 },
  { name: 'Umlazi', city: 'Durban', lat: -29.9525, lng: 30.900278 },
  { name: 'Gqeberha Central', city: 'Gqeberha', lat: -33.960102, lng: 25.6242957 },
  { name: 'Bloemfontein Central', city: 'Bloemfontein', lat: -29.116885, lng: 26.2232712 },
  { name: 'Polokwane Central', city: 'Polokwane', lat: -23.9020863, lng: 29.4443053 },
  { name: 'Mbombela', city: 'Mbombela', lat: -25.4729094, lng: 30.9772719 },
  { name: 'East London', city: 'East London', lat: -33.0191604, lng: 27.8998573 },
];

function bboxFor(area: AreaSeed): string {
  const south = area.lat - BOX_DEGREES;
  const north = area.lat + BOX_DEGREES;
  const west = area.lng - BOX_DEGREES;
  const east = area.lng + BOX_DEGREES;
  return `${south},${west},${north},${east}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const results: Array<{ areaName: string; inserted: number; insertedWithPhoto: number } | { areaName: string; error: string }> = [];

  for (let i = 0; i < AREAS.length; i++) {
    const area = AREAS[i];
    console.log(`\n=== [${i + 1}/${AREAS.length}] ${area.name} ===`);
    try {
      const result = await seedOsmArea({ bbox: bboxFor(area), areaName: area.name, cityName: area.city });
      results.push(result);
    } catch (err: any) {
      console.error(`Failed on ${area.name}: ${err.message ?? err}`);
      results.push({ areaName: area.name, error: String(err.message ?? err) });
    }

    // Pace requests so we don't hammer the shared Overpass API — it
    // rate-limited/timed-out repeatedly during development even with far
    // fewer, smaller queries than this whole list.
    if (i < AREAS.length - 1) {
      console.log('Waiting 25s before the next area...');
      await sleep(25000);
    }
  }

  console.log('\n\n========== SUMMARY ==========');
  let totalInserted = 0;
  let totalWithPhoto = 0;
  for (const r of results) {
    if ('error' in r) {
      console.log(`${r.areaName}: FAILED (${r.error})`);
    } else {
      console.log(`${r.areaName}: +${r.inserted} businesses (${r.insertedWithPhoto} with a real photo)`);
      totalInserted += r.inserted;
      totalWithPhoto += r.insertedWithPhoto;
    }
  }
  console.log(`\nTotal new businesses this run: ${totalInserted} (${totalWithPhoto} with a real photo)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
