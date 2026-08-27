/**
 * Shared logic for the per-area OSM ingestion scripts (see
 * scripts/seed-osm-*.ts). Each of those is a thin runner that just picks a
 * bounding box and area name and calls seedOsmArea() below — the tag
 * mapping, hours parsing, and DB-writing logic lives here once so adding a
 * new area doesn't mean copy-pasting ~300 lines.
 *
 * Data source: © OpenStreetMap contributors, available under the Open
 * Database License (ODbL) — https://www.openstreetmap.org/copyright.
 * Attribution is shown site-wide in the frontend footer per the license.
 */
import { randomBytes } from 'crypto';
import { join } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Business, Location, OperatingHours } from '../../src/business/entities/business.entity';
import { BusinessCategory } from '../../src/business-category/entities/business-category.entity';
import { BusinessSubcategory } from '../../src/business-category/entities/business-subcategory.entity';
import { User } from '../../src/users/entities/user.entity';

const SEED_OWNER_EMAIL = 'directory@thecosmopolitan.app';

const DEFAULT_AMENITY_TAGS =
  'cafe|restaurant|bar|pub|fast_food|pharmacy|clinic|hairdresser|dentist|doctors';

// amenity/shop values that come back from Overpass but aren't the kind of
// independent local business this app lists (chain banks, fuel stations,
// whole shopping centres, or tags too vague to categorize).
const EXCLUDED_TAG_VALUES = new Set(['bank', 'fuel', 'mall', 'yes', 'trade', 'atm', 'erotic']);

type Mapping = { category: string; subcategory?: string };

// OSM shop=*/amenity=* value -> this app's category (and, where a clean
// match exists, subcategory) slugs. Anything not listed here is skipped
// and logged rather than dumped into "Other" — see skippedUnmapped in the
// summary each run prints.
const OSM_TAG_TO_CATEGORY: Record<string, Mapping> = {
  // Food
  restaurant: { category: 'food', subcategory: 'restaurants' },
  fast_food: { category: 'food' },
  cafe: { category: 'food' },
  coffee: { category: 'food' },
  bar: { category: 'food' },
  pub: { category: 'food' },
  alcohol: { category: 'food' },
  butcher: { category: 'food' },
  bakery: { category: 'food', subcategory: 'bakery' },
  deli: { category: 'food' },
  // Shopping
  supermarket: { category: 'shopping' },
  convenience: { category: 'shopping' },
  clothes: { category: 'shopping', subcategory: 'clothing' },
  shoes: { category: 'shopping', subcategory: 'shoes-accessories' },
  fabric: { category: 'shopping' },
  houseware: { category: 'shopping' },
  bed: { category: 'shopping' },
  jewelry: { category: 'shopping' },
  perfumery: { category: 'shopping' },
  books: { category: 'shopping' },
  stationery: { category: 'shopping' },
  sports: { category: 'shopping' },
  furniture: { category: 'shopping' },
  music: { category: 'shopping' },
  gift: { category: 'shopping', subcategory: 'gifts' },
  florist: { category: 'shopping', subcategory: 'flowers' },
  second_hand: { category: 'shopping', subcategory: 'second-hand-clothing' },
  // Beauty
  cosmetics: { category: 'beauty' },
  beauty: { category: 'beauty' },
  piercing: { category: 'beauty', subcategory: 'tattoo-piercing' },
  tattoo: { category: 'beauty', subcategory: 'tattoo-piercing' },
  hairdresser: { category: 'beauty', subcategory: 'hair-salon' },
  // Health & Wellness
  pharmacy: { category: 'health-and-wellness', subcategory: 'clinic-pharmacy' },
  chemist: { category: 'health-and-wellness', subcategory: 'clinic-pharmacy' },
  doctors: { category: 'health-and-wellness', subcategory: 'clinic-pharmacy' },
  clinic: { category: 'health-and-wellness', subcategory: 'clinic-pharmacy' },
  dentist: { category: 'health-and-wellness', subcategory: 'dentist' },
  optician: { category: 'health-and-wellness', subcategory: 'optometrist' },
  // Automotive
  car: { category: 'automotive' },
  car_repair: { category: 'automotive', subcategory: 'mechanics' },
  car_parts: { category: 'automotive' },
  tyres: { category: 'automotive', subcategory: 'tyre-fitment' },
  car_wash: { category: 'automotive', subcategory: 'car-wash-valet' },
  // Tech & Repairs
  mobile_phone: { category: 'tech-and-repairs', subcategory: 'phone-accessories-vendor' },
  electronics: { category: 'tech-and-repairs' },
  computer: { category: 'tech-and-repairs', subcategory: 'laptop-computer-repair' },
  // Professional Services
  travel_agency: { category: 'professional-services' },
  lawyer: { category: 'professional-services', subcategory: 'lawyers' },
  insurance: { category: 'professional-services', subcategory: 'insurance-brokers' },
  accountant: { category: 'professional-services', subcategory: 'accountants-bookkeepers' },
  // Skilled trades / other
  doityourself: { category: 'skilled-trades-and-construction' },
  garden_centre: { category: 'home-services', subcategory: 'gardening-landscaping' },
  tiles: { category: 'skilled-trades-and-construction', subcategory: 'tilers' },
  funeral_directors: { category: 'other' },
  // office=estate_agent — real letting/property-management companies, not
  // room listings themselves (OSM has no rental price/availability data,
  // and this app's Room entity requires a real price — fabricating one
  // isn't an option). Listing the agency lets someone actually contact a
  // real business; no subcategory fits cleanly under Professional Services.
  estate_agent: { category: 'professional-services' },
  property_management: { category: 'professional-services' },
  // Added after the first multi-area run surfaced these as common but
  // unmapped — see skippedUnmapped in that run's per-area logs.
  tailor: { category: 'street-and-township-traders', subcategory: 'tailor-seamstress' },
  shoe_repair: { category: 'street-and-township-traders', subcategory: 'cobbler-shoe-repair' },
  greengrocer: { category: 'food', subcategory: 'fruit-veg-stand' },
  pastry: { category: 'food', subcategory: 'bakery' },
  juice_bar: { category: 'food' },
  health_food: { category: 'food' },
  pet: { category: 'pets-and-animals', subcategory: 'pet-shop' },
  dry_cleaning: { category: 'home-services', subcategory: 'laundry-ironing' },
  laundry: { category: 'home-services', subcategory: 'laundry-ironing' },
  storage_rental: { category: 'rentals-and-equipment-hire' },
  motorcycle: { category: 'automotive' },
  copyshop: { category: 'tech-and-repairs', subcategory: 'printer-cartridge-refill' },
  internet_cafe: { category: 'tech-and-repairs' },
  department_store: { category: 'shopping' },
  variety_store: { category: 'shopping' },
  wholesale: { category: 'shopping' },
  newsagent: { category: 'shopping' },
  pawnbroker: { category: 'shopping' },
  hairdresser_supply: { category: 'shopping' },
  medical_supply: { category: 'shopping' },
  household_linen: { category: 'shopping' },
  spices: { category: 'shopping' },
  art: { category: 'shopping' },
  leather: { category: 'shopping' },
  hardware: { category: 'shopping' },
  bicycle: { category: 'shopping' },
  craft: { category: 'shopping' },
  outdoor: { category: 'shopping' },
  baby_goods: { category: 'shopping' },
  electrical: { category: 'shopping' },
  tobacco: { category: 'shopping' },
  bag: { category: 'shopping' },
  photo: { category: 'shopping' },
  skateboard: { category: 'shopping' },
  gold_buyer: { category: 'shopping' },
  lighting: { category: 'shopping' },
  kitchen: { category: 'shopping' },
  interior_decoration: { category: 'shopping' },
  sign_shop: { category: 'shopping' },
  religion: { category: 'shopping' }, // shop=religion: devotional/religious goods store.
  public_bath: { category: 'other' },
};

const DAY_ORDER: (keyof OperatingHours)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];
const DAY_TOKENS: Record<string, keyof OperatingHours> = {
  Mo: 'monday', Tu: 'tuesday', We: 'wednesday', Th: 'thursday',
  Fr: 'friday', Sa: 'saturday', Su: 'sunday',
};

// Small best-effort parser for OSM's opening_hours syntax (e.g.
// "Mo-Fr 08:00-17:00; Sa 08:00-13:00; Su off"). Doesn't cover the full
// spec (holidays, comments, overlapping rules) — days it can't parse fall
// back to "Contact for hours" rather than a wrong guess.
function parseOpeningHours(raw?: string): OperatingHours {
  const fallback = 'Contact for hours';
  const hours = {
    monday: fallback, tuesday: fallback, wednesday: fallback, thursday: fallback,
    friday: fallback, saturday: fallback, sunday: fallback,
  } as OperatingHours;
  if (!raw) return hours;

  for (const segment of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const match = segment.match(
      /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/,
    );
    if (!match) continue;
    const [, dayPart, timePart] = match;
    // Frontend's "open now" check expects "HH:MM - HH:MM" (spaced dash) —
    // see BusinessCard.tsx's timeToMinutes/split(" - "). OSM gives
    // "HH:MM-HH:MM" with no spaces.
    const value = /off|closed/i.test(timePart)
      ? 'Closed'
      : timePart.trim().replace(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/, '$1 - $2');
    for (const day of expandDays(dayPart)) hours[day] = value;
  }
  return hours;
}

function expandDays(dayPart: string): (keyof OperatingHours)[] {
  const result: (keyof OperatingHours)[] = [];
  for (const part of dayPart.split(',').map((s) => s.trim())) {
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      const startIdx = DAY_ORDER.indexOf(DAY_TOKENS[start]);
      const endIdx = DAY_ORDER.indexOf(DAY_TOKENS[end]);
      if (startIdx === -1 || endIdx === -1) continue;
      for (let i = startIdx; ; i = (i + 1) % 7) {
        result.push(DAY_ORDER[i]);
        if (i === endIdx) break;
      }
    } else if (DAY_TOKENS[part]) {
      result.push(DAY_TOKENS[part]);
    }
  }
  return result;
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return tags['addr:full'];
}

// Real, legitimately-reusable photos only — never a hotlinked photo from a
// business's own marketing site (that's their copyrighted material, not
// ours to embed without permission). OSM's own `image` tag (when it's a
// direct file URL) and `wikimedia_commons` tag (File:... — Commons media is
// separately, explicitly openly licensed, same spirit as OSM's own ODbL)
// are the two safe cases. Coverage is low — most OSM entries have neither —
// but where they exist, this is a real photo of the real place.
function buildImageUrls(tags: Record<string, string>): string[] {
  const urls: string[] = [];
  if (tags.image && /^https?:\/\/.+\.(jpe?g|png|gif|webp)$/i.test(tags.image)) {
    urls.push(tags.image);
  }
  if (tags.wikimedia_commons?.startsWith('File:')) {
    const filename = tags.wikimedia_commons.slice('File:'.length);
    urls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`);
  }
  return urls;
}

function buildDescription(tags: Record<string, string>, categoryName: string, areaName: string, cityName: string): string {
  // areaName and cityName are often the same word (e.g. "Stellenbosch") —
  // skip the redundant ", Stellenbosch, Stellenbosch."
  const place = areaName === cityName ? areaName : `${areaName}, ${cityName}`;
  const parts = [`${tags.name} is a ${categoryName.toLowerCase()} listed in ${place}.`];
  if (tags.cuisine) {
    parts.push(`Cuisine: ${tags.cuisine.replace(/_/g, ' ').split(';').join(', ')}.`);
  }
  if (tags.brand && tags.brand !== tags.name) {
    parts.push(`Part of the ${tags.brand} chain.`);
  }
  return parts.join(' ');
}

export interface SeedOsmAreaOptions {
  // South, west, north, east — e.g. from Nominatim's boundingbox, reordered.
  bbox: string;
  areaName: string;
  // The city/town areaName sits in, used in each listing's description
  // (e.g. "Hatfield, Pretoria."). Defaults to areaName itself for areas
  // that ARE a city/town in their own right (Stellenbosch, Mbombela, ...).
  cityName?: string;
  // Extra amenity=* values to search beyond DEFAULT_AMENITY_TAGS, for areas
  // where the default list misses something relevant (each still needs an
  // OSM_TAG_TO_CATEGORY entry above to actually get imported).
  extraAmenityTags?: string[];
}

export async function seedOsmArea({ bbox, areaName, cityName = areaName, extraAmenityTags = [] }: SeedOsmAreaOptions) {
  const amenityTags = [DEFAULT_AMENITY_TAGS, ...extraAmenityTags].join('|');
  const overpassQuery = `[out:json][timeout:60];
(
  node["shop"](${bbox});
  node["amenity"~"${amenityTags}"](${bbox});
  node["office"~"estate_agent|property_management"](${bbox});
  way["shop"](${bbox});
  way["amenity"~"${amenityTags}"](${bbox});
  way["office"~"estate_agent|property_management"](${bbox});
);
out center tags;`;

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [join(__dirname, '../../src/**/*.entity.ts')],
    synchronize: false,
  });
  await dataSource.initialize();
  console.log('Connected to database.');

  const userRepo = dataSource.getRepository(User);
  const businessRepo = dataSource.getRepository(Business);
  const categoryRepo = dataSource.getRepository(BusinessCategory);
  const subcategoryRepo = dataSource.getRepository(BusinessSubcategory);

  // 1. Ensure the shared placeholder owner exists.
  let seedOwner = await userRepo.findOne({ where: { email: SEED_OWNER_EMAIL } });
  if (!seedOwner) {
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    seedOwner = await userRepo.save(
      userRepo.create({
        firstName: 'Cosmopolitan',
        surname: 'Directory',
        email: SEED_OWNER_EMAIL,
        emailVerified: true,
        passwordHash,
      }),
    );
    console.log(`Created placeholder owner user #${seedOwner.id} (${SEED_OWNER_EMAIL}).`);
  } else {
    console.log(`Using existing placeholder owner user #${seedOwner.id}.`);
  }

  // 2. Load categories/subcategories into lookup maps.
  const categories = await categoryRepo.find();
  const subcategories = await subcategoryRepo.find({ relations: { category: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const subcategoryBySlug = new Map(subcategories.map((s) => [`${s.category.id}:${s.slug}`, s]));

  // 3. Fetch OSM data. The public Overpass API is a shared, sometimes
  // overloaded resource — a 504/timeout or dropped connection here doesn't
  // mean the area is bad, just that the server was busy at that moment.
  // Retried a couple of times with backoff before giving up on this area
  // (the caller can also just re-run the whole batch later — every insert
  // is keyed by OSM id, so a retry never duplicates anything).
  const MAX_ATTEMPTS = 3;
  let data: { elements: any[] } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`Querying Overpass API for ${areaName} (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          'User-Agent': 'CosmopolitanApp-DataSeed/1.0 (real-listing import script)',
        },
        body: new URLSearchParams({ data: overpassQuery }).toString(),
      });
      if (!res.ok) {
        throw new Error(`Overpass request failed: ${res.status} ${await res.text()}`);
      }
      data = (await res.json()) as { elements: any[] };
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = attempt * 15000;
        console.log(`  Attempt ${attempt} failed (${(err as Error).message ?? err}); retrying in ${backoffMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  if (!data) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  const elements = data.elements ?? [];
  console.log(`Received ${elements.length} elements.`);

  let inserted = 0;
  let insertedWithPhoto = 0;
  let skippedExisting = 0;
  let skippedUnnamed = 0;
  let skippedExcluded = 0;
  let skippedUnmapped = 0;
  let skippedNoAddress = 0;
  const unmappedTags = new Map<string, number>();

  for (const el of elements) {
    const tags: Record<string, string> = el.tags ?? {};
    if (!tags.name) {
      skippedUnnamed++;
      continue;
    }

    const tagValue = tags.shop || tags.amenity || tags.office;
    if (!tagValue || EXCLUDED_TAG_VALUES.has(tagValue)) {
      skippedExcluded++;
      continue;
    }

    const mapping = OSM_TAG_TO_CATEGORY[tagValue];
    const category = mapping && categoryBySlug.get(mapping.category);
    if (!category) {
      skippedUnmapped++;
      unmappedTags.set(tagValue, (unmappedTags.get(tagValue) ?? 0) + 1);
      continue;
    }
    const subcategory = mapping.subcategory
      ? subcategoryBySlug.get(`${category.id}:${mapping.subcategory}`) ?? null
      : null;

    const externalId = `osm:${el.type}/${el.id}`;
    const existing = await businessRepo.findOne({ where: { externalId } });
    if (existing) {
      skippedExisting++;
      continue;
    }

    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lng = el.type === 'node' ? el.lon : el.center?.lon;
    const address = buildAddress(tags);

    // office=* entries (estate agents etc.) get skipped without a real
    // structured address rather than shown with a blank address line or,
    // worse, a stale head-office address that contradicts where the pin
    // actually sits — unlike shops, a listing here exists specifically so
    // someone can go find/contact the business, so a missing address is a
    // reason not to include it rather than a cosmetic gap.
    if (tags.office && !address) {
      skippedNoAddress++;
      continue;
    }

    const location: Location = { address, area: areaName, lat, lng };
    const images = buildImageUrls(tags);

    const business = businessRepo.create({
      externalId,
      owner: seedOwner,
      name: tags.name,
      category,
      subcategory,
      businessType: 'physical',
      phoneNumber: tags.phone || tags['contact:phone'] || null,
      rating: 0,
      reviewCount: 0,
      location,
      description: buildDescription(tags, category.name, areaName, cityName),
      images,
      videos: null,
      operatingHours: parseOpeningHours(tags.opening_hours),
    });
    await businessRepo.save(business);
    inserted++;
    if (images.length) insertedWithPhoto++;
  }

  console.log('---');
  console.log(`Inserted: ${inserted} (${insertedWithPhoto} with a real photo)`);
  console.log(`Skipped (already imported): ${skippedExisting}`);
  console.log(`Skipped (unnamed): ${skippedUnnamed}`);
  console.log(`Skipped (excluded tag e.g. bank/fuel/mall): ${skippedExcluded}`);
  console.log(`Skipped (no category mapping): ${skippedUnmapped}`);
  console.log(`Skipped (office listing with no real address): ${skippedNoAddress}`);
  if (unmappedTags.size) {
    console.log('  Unmapped tag values:', Object.fromEntries(unmappedTags));
  }

  await dataSource.destroy();
  return { areaName, inserted, insertedWithPhoto };
}
