// Full reset + launch seed:
//   1. Wipes all listings/activity/user data, keeping business taxonomy.
//   2. Creates the admin (reports/reviews moderator) and one regular owner.
//   3. Seeds exactly 10 rooms + 10 businesses + 10 gigs per SA province
//      (9 provinces -> 90/90/90), all owned by that regular user.
//
// Image keywords below were verified individually against the live
// loremflickr service (scripts/verify-image-keywords.js +
// fix-image-keywords.js) — every combo here resolves to a real matching
// photo, not loremflickr's random "defaultImage" fallback. A few of the
// original candidate keyword sets (e.g. the SA-specific slang word
// "shisanyama" alone, or "spaza") had zero tagged photos on Flickr and
// silently fell back to unrelated random stock (a cat statue with cars in
// the background, in one observed case) — that's the exact "apartment
// listing shows a car" failure mode this file avoids by construction.
//
// Usage: node scripts/seed-province-launch.js

require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const ADMIN = {
  firstName: "Banele",
  surname: "Ngubane",
  email: "banelengubane107@gmail.com",
  password: "King@2025",
};

const OWNER = {
  firstName: "Comfort",
  surname: "Ngubane",
  email: "comfortngubane10@gmail.com",
  password: "King@2025",
  phoneNumber: "+27723255319",
};

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "cosmopolitan",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let rngState = 1337;
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
  return (rand() - 0.5) * 0.06;
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

let imgLock = 1;
function img(keywords) {
  imgLock += 1;
  return `https://loremflickr.com/900/600/${encodeURIComponent(keywords)}?lock=${imgLock}`;
}
function images(keywords, count) {
  return Array.from({ length: count }, () => img(keywords));
}

// Only two clips are used because there's no free keyword-searchable video
// stock API available (loremflickr has no video equivalent) — these are
// generic motion placeholders, not topically matched to the listing, unlike
// the images. Both were checked reachable (200 OK) before use.
const VIDEO_POOL = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
];
// "Here and there" -> not every listing, not none.
const VIDEO_CHANCE = 0.3;
function maybeVideo() {
  return chance(VIDEO_CHANCE) ? [pick(VIDEO_POOL)] : [];
}

// ---------------------------------------------------------------------------
// Provinces — a handful of real townships/suburbs per province (used for
// address text + coordinates), grouped so all 10 listings of a given type
// land somewhere real within that province rather than one stacked point.
// ---------------------------------------------------------------------------

const PROVINCES = [
  {
    name: "Gauteng",
    areas: [
      { name: "Soweto", lat: -26.2485, lng: 27.854 },
      { name: "Alexandra", lat: -26.1076, lng: 28.0961 },
      { name: "Tembisa", lat: -25.9968, lng: 28.2293 },
      { name: "Mamelodi", lat: -25.7062, lng: 28.3721 },
      { name: "Soshanguve", lat: -25.5241, lng: 28.109 },
    ],
  },
  {
    name: "Western Cape",
    areas: [
      { name: "Khayelitsha", lat: -34.0389, lng: 18.6725 },
      { name: "Gugulethu", lat: -33.9667, lng: 18.5667 },
      { name: "Mitchells Plain", lat: -34.0333, lng: 18.6167 },
      { name: "Delft", lat: -33.9667, lng: 18.6667 },
      { name: "Langa", lat: -33.9333, lng: 18.5333 },
    ],
  },
  {
    name: "Eastern Cape",
    areas: [
      { name: "Mdantsane", lat: -32.9333, lng: 27.7167 },
      { name: "Zwide", lat: -33.85, lng: 25.6167 },
      { name: "New Brighton", lat: -33.8833, lng: 25.6167 },
      { name: "Motherwell", lat: -33.7833, lng: 25.5167 },
      { name: "Duncan Village", lat: -32.9833, lng: 27.9167 },
    ],
  },
  {
    name: "KwaZulu-Natal",
    areas: [
      { name: "Umlazi", lat: -29.9667, lng: 30.8833 },
      { name: "KwaMashu", lat: -29.7333, lng: 30.95 },
      { name: "Inanda", lat: -29.7, lng: 30.9167 },
      { name: "Chatsworth", lat: -29.9333, lng: 30.8833 },
      { name: "Ntuzuma", lat: -29.7333, lng: 30.9167 },
    ],
  },
  {
    name: "Free State",
    areas: [
      { name: "Botshabelo", lat: -29.25, lng: 26.7167 },
      { name: "Thabong", lat: -27.9833, lng: 26.7333 },
      { name: "Mangaung", lat: -29.1167, lng: 26.2167 },
      { name: "Phuthaditjhaba", lat: -28.5167, lng: 28.8167 },
    ],
  },
  {
    name: "Limpopo",
    areas: [
      { name: "Seshego", lat: -23.8667, lng: 29.4 },
      { name: "Mankweng", lat: -23.8833, lng: 29.7 },
      { name: "Lebowakgomo", lat: -24.2, lng: 29.5 },
    ],
  },
  {
    name: "Mpumalanga",
    areas: [
      { name: "KwaMhlanga", lat: -25.4667, lng: 28.7 },
      { name: "Kanyamazane", lat: -25.4833, lng: 31.0333 },
      { name: "eMbalenhle", lat: -26.5333, lng: 29.0667 },
    ],
  },
  {
    name: "North West",
    areas: [
      { name: "Jouberton", lat: -26.9, lng: 26.65 },
      { name: "Ikageng", lat: -26.6667, lng: 27.2333 },
      { name: "Tlhabane", lat: -25.6667, lng: 27.2333 },
    ],
  },
  {
    name: "Northern Cape",
    areas: [
      { name: "Galeshewe", lat: -28.7167, lng: 24.7667 },
      { name: "Roodepan", lat: -28.7333, lng: 24.6833 },
    ],
  },
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

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Businesses — image keywords verified (see file header); the 14 combos
// that originally fell back to loremflickr's random default were replaced
// with narrower, confirmed-working alternatives.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Gigs — no images/videos: the Gig entity has no such columns (text +
// location only, by design — see gig.entity.ts).
// ---------------------------------------------------------------------------

const URGENCIES = ["flexible", "flexible", "flexible", "this_week", "this_week", "today"];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function main() {
  const client = await pool.connect();
  try {
    console.log("Wiping listing/activity/user tables...");
    await client.query(`
      TRUNCATE TABLE
        bookings, blocked_slots, business_booking_settings,
        businesses, room, gigs, reports, uploaded_image_hashes,
        verification_code, otp, auth, "user"
      RESTART IDENTITY CASCADE
    `);

    console.log("Creating admin (reports/reviews moderator)...");
    const adminHash = await bcrypt.hash(ADMIN.password, 10);
    await client.query(
      `INSERT INTO "user" ("firstName", surname, email, "emailVerified", "passwordHash", role)
       VALUES ($1,$2,$3,true,$4,'admin')`,
      [ADMIN.firstName, ADMIN.surname, ADMIN.email, adminHash],
    );

    console.log("Creating owner (Comfort Ngubane)...");
    const ownerHash = await bcrypt.hash(OWNER.password, 10);
    const ownerRes = await client.query(
      `INSERT INTO "user"
        ("firstName", surname, email, "emailVerified", "phoneNumber", "phoneVerified", "passwordHash", role)
       VALUES ($1,$2,$3,true,$4,true,$5,'user')
       RETURNING id`,
      [OWNER.firstName, OWNER.surname, OWNER.email, OWNER.phoneNumber, ownerHash],
    );
    const ownerId = ownerRes.rows[0].id;

    const subcatRes = await client.query(`
      SELECT s.id, s.slug AS "subSlug", s."categoryId", c.slug AS "catSlug"
      FROM business_subcategories s
      JOIN business_categories c ON c.id = s."categoryId"
    `);
    const allSubcats = subcatRes.rows;
    console.log(`Loaded ${allSubcats.length} business subcategories.`);

    let roomCount = 0, bizCount = 0, gigCount = 0;

    for (const province of PROVINCES) {
      // --- ROOMS: 10 per province -----------------------------------------
      for (let i = 0; i < 10; i++) {
        const area = pick(province.areas);
        const cat = pick(ROOM_CATS);
        const bedrooms = randInt(cat.bedrooms[0], cat.bedrooms[1]);
        const bathrooms = Math.max(1, Math.min(bedrooms, randInt(1, 3)));
        const size = randInt(cat.size[0], cat.size[1]);
        const price = randInt(cat.price[0], cat.price[1]);
        const name = pick(ROOM_NAME_TEMPLATES)(cat.name, area.name);
        const description = `${cat.name} available to rent in ${area.name}, ${province.name}. ` +
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
            OWNER.phoneNumber, OWNER.phoneNumber, ownerId, "active",
          ],
        );
        roomCount++;
      }

      // --- BUSINESSES: 10 per province -------------------------------------
      for (let i = 0; i < 10; i++) {
        const area = pick(province.areas);
        const sub = pick(allSubcats);
        const meta = SUBCAT_META[sub.subSlug] || SUBCAT_META.general;
        const owner = ownerName();
        const name = pick(BIZ_NAME_TEMPLATES)(area.name, meta.noun, owner);
        const isOnline = ONLINE_ELIGIBLE.has(sub.subSlug) && chance(0.3);
        const description = `${meta.noun} serving ${area.name}${isOnline ? "" : ` and surrounding ${province.name} areas`}. ` +
          `${pick(BIZ_DESC_EXTRAS)} ${pick(BIZ_DESC_EXTRAS)}`;
        const location = isOnline ? null : jitteredLocation(area);
        const supportsDelivery = !isOnline && chance(0.4);
        const supportsWhatsAppOrder = true;
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
            ownerId, isOnline ? "online" : "physical", supportsDelivery, supportsWhatsAppOrder,
            OWNER.phoneNumber, OWNER.phoneNumber, pick(PRICE_RANGES),
            sub.categoryId, sub.id, videos.join(",") || null, 0, "active",
          ],
        );
        bizCount++;
      }

      // --- GIGS: 10 per province --------------------------------------------
      for (let i = 0; i < 10; i++) {
        const area = pick(province.areas);
        const sub = pick(allSubcats);
        const meta = SUBCAT_META[sub.subSlug] || SUBCAT_META.general;
        const type = chance(0.5) ? "need_help" : "offering_work";
        const title = type === "need_help"
          ? `Need ${meta.noun} in ${area.name}`
          : `Offering ${meta.noun} services in ${area.name}`;
        const description = type === "need_help"
          ? `Looking for someone to help with ${meta.noun.toLowerCase()} in ${area.name}, ${province.name}. ${pick(BIZ_DESC_EXTRAS)}`
          : `Available for ${meta.noun.toLowerCase()} work around ${area.name}, ${province.name}. ${pick(BIZ_DESC_EXTRAS)}`;
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
            urgency, expiresAt, JSON.stringify(location), OWNER.phoneNumber, 0, "active",
            ownerId, sub.categoryId, sub.id,
          ],
        );
        gigCount++;
      }

      console.log(`  ${province.name}: 10 rooms, 10 businesses, 10 gigs`);
    }

    console.log(`\nDone. Owner: ${OWNER.email} (id ${ownerId})`);
    console.log(`Admin: ${ADMIN.email} (role admin)`);
    console.log(`Totals: ${roomCount} rooms, ${bizCount} businesses, ${gigCount} gigs across ${PROVINCES.length} provinces.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
