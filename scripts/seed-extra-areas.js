// Additive seed — does NOT touch existing data. Adds 10 rooms + 10
// businesses + 10 gigs (all owned by the existing Comfort Ngubane account)
// for each named area below. Image keywords are the same verified set used
// by seed-province-launch.js (see that file's header for why — loremflickr
// silently falls back to random unrelated stock for unverified keyword
// combos).
//
// Usage: node scripts/seed-extra-areas.js

require("dotenv").config();
const { Pool } = require("pg");

const OWNER_EMAIL = "comfortngubane10@gmail.com";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "cosmopolitan",
});

// ---------------------------------------------------------------------------
// Helpers — different RNG seed than seed-province-launch.js so names/details
// don't come out identical to the first 270 listings.
// ---------------------------------------------------------------------------

let rngState = 90210;
function rand() {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  rngState >>>= 0;
  return rngState / 4294967296;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function chance(p) {
  return rand() < p;
}
function jitterDeg() {
  return (rand() - 0.5) * 0.03;
}
function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let imgLock = 5000;
function img(keywords) {
  imgLock += 1;
  return `https://loremflickr.com/900/600/${encodeURIComponent(keywords)}?lock=${imgLock}`;
}
function images(keywords, count) {
  return Array.from({ length: count }, () => img(keywords));
}

const VIDEO_POOL = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
];
const VIDEO_CHANCE = 0.3;
function maybeVideo() {
  return chance(VIDEO_CHANCE) ? [pick(VIDEO_POOL)] : [];
}

// ---------------------------------------------------------------------------
// Areas to add — real coordinates.
// ---------------------------------------------------------------------------

const AREAS = [
  { name: "Cosmo City", province: "Gauteng", lat: -26.0219, lng: 27.9308 },
  { name: "Jouberton", province: "North West", lat: -26.9, lng: 26.65 },
  { name: "Rustenburg", province: "North West", lat: -25.6672, lng: 27.2424 },
];

const STREET_NAMES = ["Church", "Main", "Nelson Mandela", "Vilakazi", "Market",
  "Station", "School", "Kopanong", "Freedom", "Sisulu", "Khumalo", "Union",
  "Thabo Mbeki", "Dube", "Moshoeshoe"];
const STREET_TYPES = ["Street", "Road", "Avenue", "Drive", "Way"];
function randomAddress(area) {
  return `${randInt(1, 300)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}, ${area.name}`;
}
function jitteredLocation(area) {
  return {
    address: randomAddress(area),
    area: area.name,
    lat: round(area.lat + jitterDeg(), 6),
    lng: round(area.lng + jitterDeg(), 6),
  };
}

// --- Rooms -------------------------------------------------------------

const ROOM_CATS = [
  { name: "Apartment", img: "apartment,building", bedrooms: [1, 3], size: [35, 90], price: [2500, 7000] },
  { name: "Room", img: "bedroom,room", bedrooms: [1, 1], size: [12, 25], price: [800, 2800] },
  { name: "Bachelor", img: "studio,apartment", bedrooms: [1, 1], size: [18, 32], price: [1200, 3500] },
  { name: "House", img: "house,exterior", bedrooms: [2, 5], size: [60, 180], price: [3500, 12000] },
  { name: "Guest House", img: "guesthouse,bnb", bedrooms: [1, 2], size: [20, 50], price: [2000, 6000] },
  { name: "Student Accommodation", img: "dorm,student,room", bedrooms: [1, 1], size: [12, 22], price: [1000, 2500] },
];
const PROPERTY_TYPES = ["Rental", "Rental", "Rental", "Airbnb", "Lodge"];
const LEASE_TERMS = ["Month-to-Month", "3 Months", "6 Months", "12 Months"];
const ROOM_NAME_TEMPLATES = [
  (cat, area) => `Cozy ${cat} in ${area}`,
  (cat, area) => `Spacious ${cat} - ${area}`,
  (cat, area) => `${cat} to Let in ${area}`,
  (cat, area) => `Modern ${cat}, ${area}`,
  (cat, area) => `Affordable ${cat} near ${area} Centre`,
];
const ROOM_DESC_EXTRAS = [
  "Close to taxi rank and local shops.",
  "Secure, quiet neighbourhood.",
  "Walking distance to schools and clinics.",
  "Available immediately for the right tenant.",
  "Water and electricity prepaid.",
  "Well-maintained, recently painted.",
];

function weekdayHours() {
  return pick(["08:00 - 17:00", "08:00 - 18:00", "09:00 - 17:00", "07:30 - 17:30"]);
}
function operatingHoursFor(physical) {
  if (!physical) {
    return { monday: "Closed", tuesday: "Closed", wednesday: "Closed",
      thursday: "Closed", friday: "Closed", saturday: "Closed", sunday: "Closed" };
  }
  const weekday = weekdayHours();
  const sat = chance(0.7) ? pick(["08:00 - 13:00", "09:00 - 14:00", weekday]) : "Closed";
  const sun = chance(0.25) ? pick(["09:00 - 13:00", weekday]) : "Closed";
  return { monday: weekday, tuesday: weekday, wednesday: weekday, thursday: weekday,
    friday: weekday, saturday: sat, sunday: sun };
}

// --- Businesses — same verified keyword map as seed-province-launch.js ---

const SUBCAT_META = {
  "spaza-shop": { img: "convenience,store", noun: "Spaza Shop" },
  "hawker-general-trader": { img: "street,vendor,market", noun: "General Traders" },
  "mai-mai-traditional-traders": { img: "african,market,craft", noun: "Traditional Traders" },
  "airtime-data-vendor": { img: "mobile,phone,airtime", noun: "Airtime & Data" },
  "flea-market-second-hand-trader": { img: "flea,market", noun: "Flea Market" },
  "tailor-seamstress": { img: "tailor,sewing,fabric", noun: "Tailoring" },
  "cobbler-shoe-repair": { img: "shoe,repair,cobbler", noun: "Shoe Repairs" },
  "scrap-metal-dealer": { img: "scrap,metal,junkyard", noun: "Scrap Metal" },
  "kota-shisanyama": { img: "braai,meat", noun: "Shisanyama" },
  "street-food-vendor": { img: "street,food,vendor", noun: "Street Food" },
  "braai-grill": { img: "braai,barbecue,grill", noun: "Braai Spot" },
  "fruit-veg-stand": { img: "fruit,vegetables,market", noun: "Fruit & Veg" },
  "restaurants": { img: "restaurant,dining,food", noun: "Restaurant" },
  "bakery": { img: "bakery,bread,pastries", noun: "Bakery" },
  "lunch-box-packages": { img: "lunchbox,food,meal", noun: "Lunch Box Packages" },
  "catering": { img: "catering,buffet,event,food", noun: "Catering" },
  "meat-packages": { img: "meat,butcher,beef", noun: "Meat Packages" },
  "snacks": { img: "snacks,chips,crisps", noun: "Snacks" },
  "treats": { img: "cupcakes,dessert,sweets", noun: "Treats" },
  "hair-salon": { img: "hair,salon,hairdresser", noun: "Hair Salon" },
  "barber": { img: "barber,barbershop,haircut", noun: "Barbershop" },
  "traditional-hair-braiding": { img: "hair,braids,braiding", noun: "Braiding" },
  "weave-extensions": { img: "hair,weave,extensions", noun: "Weave & Extensions" },
  "nails": { img: "nail,manicure,salon", noun: "Nail Bar" },
  "makeup": { img: "makeup,cosmetics,beauty", noun: "Makeup Studio" },
  "eyelashes-brows": { img: "eyelashes,makeup,beauty", noun: "Lashes & Brows" },
  "tattoo-piercing": { img: "tattoo,ink,piercing", noun: "Tattoo Studio" },
  "djs": { img: "dj,turntable,music", noun: "DJ Services" },
  "sound-equipment": { img: "speaker,sound,audio", noun: "Sound Hire" },
  "tents": { img: "tent,marquee,event", noun: "Tent Hire" },
  "chairs": { img: "chairs,event,seating", noun: "Chair Hire" },
  "decor": { img: "event,decor,flowers", noun: "Event Decor" },
  "kiddies-party-packages": { img: "kids,birthday,party", noun: "Kiddies Parties" },
  "balloon-packages": { img: "balloons,party,decoration", noun: "Balloon Decor" },
  "mcs-hosts": { img: "microphone,host,stage", noun: "MC Services" },
  "photographers": { img: "camera,photographer,photo", noun: "Photography" },
  "wedding-planners": { img: "wedding,bride,ceremony", noun: "Wedding Planning" },
  "taxi-shuttle-services": { img: "minibus,taxi,transport", noun: "Taxi & Shuttle" },
  "bakkie-hire": { img: "bakkie,pickup,truck", noun: "Bakkie Hire" },
  "scholar-transport": { img: "school,bus,children", noun: "Scholar Transport" },
  "courier-delivery": { img: "delivery,courier,parcel", noun: "Courier" },
  "moving-services": { img: "moving,truck,furniture", noun: "Movers" },
  "trailer-hire": { img: "trailer,towing", noun: "Trailer Hire" },
  "tools-equipment-hire": { img: "tools,hardware,workshop", noun: "Tool Hire" },
  "generator-hire": { img: "generator,power,electricity", noun: "Generator Hire" },
  "furniture-rental": { img: "furniture,sofa,interior", noun: "Furniture Rental" },
  "appliance-rental": { img: "appliance,fridge,kitchen", noun: "Appliance Rental" },
  "venue-hire": { img: "hall,venue,event", noun: "Venue Hire" },
  "scaffolding-hire": { img: "scaffolding,construction", noun: "Scaffolding Hire" },
  "handyman": { img: "handyman,tools,repair", noun: "Handyman Services" },
  "carpenters": { img: "carpenter,woodwork,timber", noun: "Carpentry" },
  "painters": { img: "painter,paint,wall", noun: "Painting" },
  "bricklayers": { img: "brick,mason", noun: "Bricklaying" },
  "roofers": { img: "roof,roofing,construction", noun: "Roofing" },
  "tilers": { img: "tile,tiling,floor", noun: "Tiling" },
  "plasterers": { img: "plaster,wall,construction", noun: "Plastering" },
  "welders": { img: "welding,metal,workshop", noun: "Welding" },
  "locksmiths": { img: "lock,key,locksmith", noun: "Locksmith" },
  "fencing-palisade-installation": { img: "fence,gate", noun: "Fencing" },
  "second-hand-clothing": { img: "thrift,clothing,secondhand", noun: "Second-Hand Clothing" },
  "traditional-attire": { img: "african,dress", noun: "Traditional Attire" },
  "clothing": { img: "clothing,fashion,boutique", noun: "Clothing Store" },
  "shoes-accessories": { img: "shoes,sneakers,footwear", noun: "Shoes & Accessories" },
  "printed-t-shirts": { img: "tshirt,printing,apparel", noun: "Printed T-Shirts" },
  "custom-products": { img: "craft,custom,handmade", noun: "Custom Products" },
  "gifts": { img: "gift,present", noun: "Gift Shop" },
  "flowers": { img: "flowers,bouquet,florist", noun: "Florist" },
  "domestic-cleaning": { img: "cleaning,house,domestic", noun: "Domestic Cleaning" },
  "gardening-landscaping": { img: "garden,landscaping,lawn", noun: "Gardening" },
  "security-services": { img: "security,guard", noun: "Security Services" },
  "laundry-ironing": { img: "laundry,washing,ironing", noun: "Laundry & Ironing" },
  "pest-control": { img: "pest,control,exterminator", noun: "Pest Control" },
  "pool-maintenance": { img: "swimming,pool,maintenance", noun: "Pool Maintenance" },
  "traditional-healer-sangoma": { img: "traditional,herbs,healer", noun: "Traditional Healer" },
  "clinic-pharmacy": { img: "pharmacy,clinic,medicine", noun: "Clinic & Pharmacy" },
  "spa-massage": { img: "spa,massage,relaxation", noun: "Spa & Massage" },
  "fitness-trainer": { img: "gym,fitness,training", noun: "Fitness Training" },
  "dentist": { img: "dentist,dental,teeth", noun: "Dental Practice" },
  "optometrist": { img: "glasses,eyewear", noun: "Optometrist" },
  "electricians": { img: "electrician,wiring,electrical", noun: "Electrical Services" },
  "plumbers": { img: "plumber,pipes", noun: "Plumbing" },
  "tutors": { img: "tutor,books", noun: "Tutoring" },
  "notary-home-affairs-assistance": { img: "office,documents,paperwork", noun: "Home Affairs Assistance" },
  "translators": { img: "translation,language,books", noun: "Translation Services" },
  "accountants-bookkeepers": { img: "accounting,finance,office", noun: "Accounting" },
  "insurance-brokers": { img: "insurance,office,meeting", noun: "Insurance Brokers" },
  "lawyers": { img: "law,justice,office", noun: "Legal Services" },
  "car-wash-valet": { img: "car,wash", noun: "Car Wash" },
  "mechanics": { img: "mechanic,garage,engine", noun: "Mechanics" },
  "tyre-fitment": { img: "tyre,wheel,car", noun: "Tyre Fitment" },
  "panel-beating-spray-painting": { img: "car,bodywork", noun: "Panel Beating" },
  "auto-electricians": { img: "car,electrical,engine", noun: "Auto Electrical" },
  "towing-services": { img: "towtruck,tow,breakdown", noun: "Towing Services" },
  "scrap-yard-spares": { img: "junkyard,carparts,scrapyard", noun: "Scrap Yard & Spares" },
  "phone-repair": { img: "phone,repair,smartphone", noun: "Phone Repairs" },
  "phone-accessories-vendor": { img: "phone,accessories,case", noun: "Phone Accessories" },
  "appliance-repair": { img: "appliance,repair,kitchen", noun: "Appliance Repairs" },
  "tv-electronics-repair": { img: "television,electronics,repair", noun: "TV & Electronics Repair" },
  "laptop-computer-repair": { img: "laptop,computer,repair", noun: "Computer Repairs" },
  "wifi-network-installation": { img: "wifi,router,network", noun: "WiFi Installation" },
  "cctv-alarm-installation": { img: "cctv,camera,security", noun: "CCTV & Alarms" },
  "printer-cartridge-refill": { img: "printer,ink,office", noun: "Printer & Cartridge Refill" },
  "it-support": { img: "computer,office,it", noun: "IT Support" },
  "creche-ecd": { img: "kindergarten,children,preschool", noun: "Creche" },
  "driving-school": { img: "driving,school", noun: "Driving School" },
  "skills-artisan-training": { img: "training,workshop,skills", noun: "Skills Training" },
  "computer-literacy-classes": { img: "computer,classroom,training", noun: "Computer Classes" },
  "music-lessons": { img: "music,piano,guitar", noun: "Music Lessons" },
  "veterinary-services": { img: "vet,animal,clinic", noun: "Veterinary Services" },
  "pet-shop": { img: "pet,shop,animal", noun: "Pet Shop" },
  "pet-grooming": { img: "dog,grooming,pet", noun: "Pet Grooming" },
  "pet-sitting-dog-walking": { img: "dog,walking,pet", noun: "Pet Sitting" },
  "digital-products": { img: "laptop,digital,design", noun: "Digital Products" },
  "social-media-management": { img: "smartphone,social,media", noun: "Social Media Management" },
  "graphic-design": { img: "design,graphic,creative", noun: "Graphic Design" },
  "web-design-development": { img: "website,code,laptop", noun: "Web Design" },
  "cv-writing-career-coaching": { img: "resume,writing", noun: "CV Writing" },
  "content-writing-copywriting": { img: "writing,laptop,notebook", noun: "Copywriting" },
  "virtual-assistant-admin-support": { img: "office,laptop,desk", noun: "Virtual Assistant" },
  "data-entry-research": { img: "spreadsheet,office,laptop", noun: "Data Entry" },
  "general": { img: "shop,storefront,business", noun: "General Services" },
};

const ONLINE_ELIGIBLE = new Set([
  "digital-products", "social-media-management", "graphic-design",
  "web-design-development", "cv-writing-career-coaching",
  "content-writing-copywriting", "virtual-assistant-admin-support",
  "data-entry-research", "printed-t-shirts", "custom-products",
  "gifts", "translators", "tutors", "it-support", "computer-literacy-classes",
]);

const CREDENTIAL_POOLS = {
  tutors: ["BSc Mathematics Graduate", "BEd Honours Graduate", "Final-year Engineering Student"],
  "accountants-bookkeepers": ["BCom Accounting Graduate", "SAIPA Certified Bookkeeper"],
  "notary-home-affairs-assistance": ["LLB Law Graduate", "Paralegal Diploma Graduate"],
  translators: ["BA Languages Graduate", "SATI Accredited Translator"],
  lawyers: ["LLB Law Graduate (Candidate Attorney)"],
  "creche-ecd": ["National Diploma: Early Childhood Development"],
  "digital-products": ["BSc Computer Science Graduate", "Diploma in Software Development"],
  "graphic-design": ["Diploma in Graphic Design", "BA Visual Arts Graduate"],
  "web-design-development": ["National Diploma: IT (Software Development)"],
  "it-support": ["A+ / N+ Certified", "National Diploma: IT"],
};

const BIZ_NAME_TEMPLATES = [
  (area, noun) => `${area} ${noun}`,
  (area, noun) => `${noun} ${area}`,
  (area, noun, owner) => `${owner}'s ${noun}`,
  (area, noun) => `${area} ${noun} Hub`,
  (area, noun) => `Royal ${noun} - ${area}`,
];
const BIZ_DESC_EXTRAS = [
  "Affordable prices and friendly service.",
  "Same-day service available on request.",
  "Contact us on WhatsApp to place an order or book a slot.",
  "Trusted by the local community for years.",
  "Open six days a week.",
  "Quality work, no shortcuts.",
];
const PRICE_RANGES = ["$", "$", "$", "$$", "$$", "$$$", "$$$$"];
const FIRST_NAMES = ["Thabo", "Nomvula", "Sipho", "Zanele", "Andile", "Precious",
  "Bongani", "Lindiwe", "Kagiso", "Palesa"];
const SURNAMES = ["Mokoena", "Dlamini", "Nkosi", "Khumalo", "Mahlangu", "Ndlovu"];
function ownerName() {
  return `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
}

const URGENCIES = ["flexible", "flexible", "flexible", "this_week", "this_week", "today"];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function main() {
  const client = await pool.connect();
  try {
    const ownerRes = await client.query('SELECT id FROM "user" WHERE email = $1', [OWNER_EMAIL]);
    if (ownerRes.rowCount === 0) {
      throw new Error(`No user found with email ${OWNER_EMAIL}`);
    }
    const ownerId = ownerRes.rows[0].id;
    console.log(`Owner: ${OWNER_EMAIL} (id ${ownerId})`);

    const subcatRes = await client.query(`
      SELECT s.id, s.slug AS "subSlug", s."categoryId", c.slug AS "catSlug"
      FROM business_subcategories s
      JOIN business_categories c ON c.id = s."categoryId"
    `);
    const allSubcats = subcatRes.rows;
    console.log(`Loaded ${allSubcats.length} business subcategories.`);

    let roomCount = 0, bizCount = 0, gigCount = 0;

    for (const area of AREAS) {
      // --- ROOMS: 10 ---------------------------------------------------
      for (let i = 0; i < 10; i++) {
        const cat = pick(ROOM_CATS);
        const bedrooms = randInt(cat.bedrooms[0], cat.bedrooms[1]);
        const bathrooms = Math.max(1, Math.min(bedrooms, randInt(1, 3)));
        const size = randInt(cat.size[0], cat.size[1]);
        const price = randInt(cat.price[0], cat.price[1]);
        const name = pick(ROOM_NAME_TEMPLATES)(cat.name, area.name);
        const description = `${cat.name} available to rent in ${area.name}, ${area.province}. ` +
          `${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}, ${bathrooms} bathroom${bathrooms > 1 ? "s" : ""}, ${size}m². ` +
          `${pick(ROOM_DESC_EXTRAS)} ${pick(ROOM_DESC_EXTRAS)}`;
        const location = jitteredLocation(area);
        const videos = maybeVideo();

        await client.query(
          `INSERT INTO room
            (name, category, price, location, description, bedrooms, bathrooms, size,
             furnished, wifi, parking, "electricityIncluded", "waterIncluded", "petsAllowed",
             kitchen, "diningArea", "livingRoom", balcony, "smokingAllowed",
             "propertyType", "availableFrom", deposit, "leaseTerm",
             rating, "reviewCount", "reportCount", images, videos, reviews,
             "phoneNumber", "whatsappNumber", "ownerId", status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
          [
            name, cat.name, price, JSON.stringify(location), description, bedrooms, bathrooms, size,
            chance(0.4), chance(0.55), chance(0.45), chance(0.35), chance(0.45), chance(0.3),
            chance(0.5), chance(0.3), chance(0.4), chance(0.2), false,
            pick(PROPERTY_TYPES), daysFromNow(randInt(0, 21)), price, pick(LEASE_TERMS),
            chance(0.35) ? round(3.5 + rand() * 1.5, 1) : 0,
            chance(0.35) ? randInt(1, 45) : 0,
            0, images(cat.img, randInt(2, 4)).join(","), videos.join(",") || null, "[]",
            "+27723255319", "+27723255319", ownerId, "active",
          ],
        );
        roomCount++;
      }

      // --- BUSINESSES: 10 -----------------------------------------------
      for (let i = 0; i < 10; i++) {
        const sub = pick(allSubcats);
        const meta = SUBCAT_META[sub.subSlug] || SUBCAT_META.general;
        const owner = ownerName();
        const name = pick(BIZ_NAME_TEMPLATES)(area.name, meta.noun, owner);
        const isOnline = ONLINE_ELIGIBLE.has(sub.subSlug) && chance(0.3);
        const description = `${meta.noun} serving ${area.name}${isOnline ? "" : ` and surrounding ${area.province} areas`}. ` +
          `${pick(BIZ_DESC_EXTRAS)} ${pick(BIZ_DESC_EXTRAS)}`;
        const location = isOnline ? null : jitteredLocation(area);
        const supportsDelivery = !isOnline && chance(0.4);
        const rating = chance(0.45) ? round(3.3 + rand() * 1.7, 1) : 0;
        const reviewCount = rating > 0 ? randInt(1, 60) : 0;
        const credentialPool = CREDENTIAL_POOLS[sub.subSlug];
        const credential = credentialPool && chance(0.5) ? pick(credentialPool) : null;
        const videos = maybeVideo();

        await client.query(
          `INSERT INTO businesses
            ("externalId", name, credential, rating, "reviewCount", location, description, images,
             "operatingHours", "ownerId", "businessType", "supportsDelivery", "supportsWhatsAppOrder",
             "whatsappNumber", "phoneNumber", "priceRange", "categoryId", "subcategoryId", videos, "reportCount", status)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [
            name, credential, rating, reviewCount, location ? JSON.stringify(location) : null, description,
            images(meta.img, randInt(2, 4)).join(","), JSON.stringify(operatingHoursFor(!isOnline)),
            ownerId, isOnline ? "online" : "physical", supportsDelivery, true,
            "+27723255319", "+27723255319", pick(PRICE_RANGES),
            sub.categoryId, sub.id, videos.join(",") || null, 0, "active",
          ],
        );
        bizCount++;
      }

      // --- GIGS: 10 ----------------------------------------------------
      for (let i = 0; i < 10; i++) {
        const sub = pick(allSubcats);
        const meta = SUBCAT_META[sub.subSlug] || SUBCAT_META.general;
        const type = chance(0.5) ? "need_help" : "offering_work";
        const title = type === "need_help"
          ? `Need ${meta.noun} in ${area.name}`
          : `Offering ${meta.noun} services in ${area.name}`;
        const description = type === "need_help"
          ? `Looking for someone to help with ${meta.noun.toLowerCase()} in ${area.name}, ${area.province}. ${pick(BIZ_DESC_EXTRAS)}`
          : `Available for ${meta.noun.toLowerCase()} work around ${area.name}, ${area.province}. ${pick(BIZ_DESC_EXTRAS)}`;
        const urgency = pick(URGENCIES);
        const ttlDays = urgency === "today" ? 1 : urgency === "this_week" ? 7 : 30;
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
        const location = jitteredLocation(area);
        const hasPrice = chance(0.6);

        await client.query(
          `INSERT INTO gigs
            (type, title, description, price, "priceType", urgency, "expiresAt",
             location, "whatsappNumber", "reportCount", status, "ownerId", "categoryId", "subcategoryId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            type, title, description, hasPrice ? randInt(100, 3000) : null,
            hasPrice ? pick(["fixed", "hourly", "negotiable"]) : "negotiable",
            urgency, expiresAt, JSON.stringify(location), "+27723255319", 0, "active",
            ownerId, sub.categoryId, sub.id,
          ],
        );
        gigCount++;
      }

      console.log(`  ${area.name} (${area.province}): 10 rooms, 10 businesses, 10 gigs`);
    }

    console.log(`\nAdded: ${roomCount} rooms, ${bizCount} businesses, ${gigCount} gigs across ${AREAS.length} areas.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
