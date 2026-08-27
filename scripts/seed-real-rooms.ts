/**
 * Seeds real room/apartment listings sourced directly from a landlord's or
 * property manager's OWN published page about their OWN building — never
 * from a scraped classifieds aggregator (Property24/PrivateProperty/
 * Gumtree/etc.), which their Terms of Service don't allow republishing
 * from. Add a new REAL_LISTINGS entry only when you have a primary source
 * like that.
 *
 * Fields the source doesn't publish (deposit, bathrooms, leaseTerm,
 * availableFrom — all nullable on Room, see room.entity.ts) are left null
 * rather than guessed; the frontend shows "Contact landlord for details"
 * for those instead of blocking the whole listing on one missing fact.
 * `price` is the one field this always requires a real number for — a unit
 * type with no published price is left out rather than estimated (see
 * Hlanganani Gardens' 3-bedroom units below).
 *
 * Usage (from the-cosmopolitan-api/):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-real-rooms.ts
 *
 * Re-running is safe: skips any unit whose exact name already exists.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Room } from '../src/room/entities/room.entity';
import { User } from '../src/users/entities/user.entity';

const SEED_OWNER_EMAIL = 'directory@thecosmopolitan.app';

interface RealBuildingListing {
  buildingName: string;
  source: string; // URL this was sourced from, for future re-verification.
  category: string; // matches frontend/rooms/constants/room-form.constants.ts
  propertyType: string;
  location: { address: string; area: string; lat: number; lng: number };
  phoneNumber: string;
  whatsappNumber?: string;
  description: string;
  amenities: { wifi: boolean; parking: boolean; furnished: boolean };
  units: Array<{ suffix: string; bedrooms: number; price: number }>;
}

const REAL_LISTINGS: RealBuildingListing[] = [
  {
    buildingName: 'Hlanganani Gardens',
    source: 'https://www.jhc.co.za/our-buildings/hlanganani-gardens',
    category: 'Apartment',
    propertyType: 'Rental',
    location: {
      address: 'Burkina Faso Street',
      area: 'Cosmo City',
      lat: -26.0217,
      lng: 27.9257816,
    },
    phoneNumber: '0104426321', // JHC general line.
    description:
      'Hlanganani Gardens is a 283-unit affordable-housing development in ' +
      'Cosmo City, managed by the Johannesburg Housing Company (JHC) in ' +
      'two- and three-storey walk-up buildings with secure courtyard ' +
      'parking, WiFi, an on-site daycare, sports fields, and playgrounds. ' +
      'Contact JHC directly for availability and full lease terms.',
    amenities: { wifi: true, parking: true, furnished: false },
    units: [
      { suffix: '1 Bedroom Apartment', bedrooms: 1, price: 3757 },
      { suffix: '2 Bedroom Apartment', bedrooms: 2, price: 5456 },
      // 3-bedroom units exist per JHC's page but its price isn't published
      // there — left out rather than guessed.
    ],
  },
  {
    buildingName: '56 Jorissen (South Point)',
    source: 'https://www.staysouthpoint.co.za/joburg/56-jorissen',
    category: 'Student Accommodation',
    propertyType: 'Rental',
    location: {
      address: '56 Jorissen Street',
      area: 'Braamfontein',
      lat: -26.1934031,
      lng: 28.0301982,
    },
    phoneNumber: '0600189901',
    whatsappNumber: '27760115702',
    description:
      '56 Jorissen is a 1,194-room NSFAS-accredited student accommodation ' +
      'building in Braamfontein, a 5-minute walk from Wits University, ' +
      'run by South Point. Rent includes utilities and WiFi. Amenities: ' +
      '24/7 security, CCTV, biometric access control, communal kitchens, ' +
      'study rooms, a lounge, laundry facilities, and an outdoor ' +
      'courtyard. Contact South Point directly for availability.',
    amenities: { wifi: true, parking: false, furnished: true },
    units: [
      { suffix: 'Cluster Unit (2-Sharing Room)', bedrooms: 1, price: 5650 },
      { suffix: 'Cluster Unit (Single Room)', bedrooms: 1, price: 6280 },
      { suffix: 'Studio Apartment (2-Sharing)', bedrooms: 1, price: 8090 },
      { suffix: 'Studio Apartment (Single)', bedrooms: 1, price: 8300 },
      // 1-bedroom/corner/penthouse units are "price by inquiry" on South
      // Point's own page — no published number, so left out.
    ],
  },
  {
    buildingName: 'VDS (South Point)',
    source: 'https://www.staysouthpoint.co.za/pretoria/vds-pretoria',
    category: 'Student Accommodation',
    propertyType: 'Rental',
    location: {
      // South Point's page doesn't publish a street address, only "Pretoria
      // CBD" — using the same verified Pretoria Central anchor point as the
      // business seed batch (scripts/seed-osm-all-areas.ts) rather than
      // guessing a street number.
      address: 'Pretoria CBD',
      area: 'Pretoria Central',
      lat: -25.7518426,
      lng: 28.1899743,
    },
    phoneNumber: '0600189901',
    whatsappNumber: '27760115702',
    description:
      'VDS is a 990-room NSFAS-accredited student accommodation building ' +
      'in Pretoria CBD, run by South Point, with quick access to TUT and ' +
      'UP campuses. Rent includes WiFi and 24/7 security. Contact South ' +
      'Point directly for availability.',
    amenities: { wifi: true, parking: false, furnished: true },
    units: [{ suffix: 'Standard Room', bedrooms: 1, price: 5490 }],
  },
  {
    buildingName: 'Colonial House (South Point)',
    source: 'https://www.staysouthpoint.co.za/durban/colonial-house',
    category: 'Student Accommodation',
    propertyType: 'Rental',
    location: {
      // Same situation as VDS above — no street address published, only
      // "Durban CBD"; reusing the verified Durban Central anchor point.
      address: 'Durban CBD',
      area: 'Durban Central',
      lat: -29.8574209,
      lng: 31.0222278,
    },
    phoneNumber: '0600189901',
    whatsappNumber: '27760115702',
    description:
      'Colonial House is a 391-room NSFAS-accredited student ' +
      'accommodation building in Durban CBD, run by South Point, about 7 ' +
      'minutes from DUT and 10 minutes from UKZN. Rent includes WiFi and ' +
      'utilities. Contact South Point directly for availability.',
    amenities: { wifi: true, parking: false, furnished: true },
    units: [{ suffix: 'Standard Room', bedrooms: 1, price: 5490 }],
  },
];

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [join(__dirname, '../src/**/*.entity.ts')],
    synchronize: false,
  });
  await dataSource.initialize();
  console.log('Connected to database.');

  const userRepo = dataSource.getRepository(User);
  const roomRepo = dataSource.getRepository(Room);

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
    console.log(`Created placeholder owner user #${seedOwner.id}.`);
  } else {
    console.log(`Using existing placeholder owner user #${seedOwner.id}.`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const building of REAL_LISTINGS) {
    for (const unit of building.units) {
      const name = `${building.buildingName} — ${unit.suffix}`;
      const existing = await roomRepo.findOne({ where: { name } });
      if (existing) {
        console.log(`Skipping "${name}" — already exists.`);
        skipped++;
        continue;
      }

      const room = roomRepo.create({
        name,
        owner: seedOwner,
        category: building.category,
        price: unit.price,
        location: building.location,
        description: building.description,
        phoneNumber: building.phoneNumber,
        whatsappNumber: building.whatsappNumber ?? null,
        bedrooms: unit.bedrooms,
        bathrooms: null,
        size: null,
        furnished: building.amenities.furnished,
        wifi: building.amenities.wifi,
        parking: building.amenities.parking,
        electricityIncluded: false,
        waterIncluded: false,
        petsAllowed: false,
        propertyType: building.propertyType,
        availableFrom: null,
        deposit: null,
        leaseTerm: null,
        rating: 0,
        reviewCount: 0,
        images: [],
        videos: null,
      });
      await roomRepo.save(room);
      console.log(`Inserted "${name}" (source: ${building.source}).`);
      inserted++;
    }
  }

  console.log(`---\nInserted: ${inserted}\nSkipped (already imported): ${skipped}`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
