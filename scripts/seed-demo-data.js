// Wipes and repopulates businesses / rooms / gigs with a large, nationwide
// spread of South African (township-first) demo data, owned by a single
// existing account. Every listing's images are keyword-matched to what
// it actually is (via loremflickr, a free keyword-searchable image host)
// rather than the random/unrelated picsum placeholders used previously —
// that mismatch (an "apartment" listing showing an animal photo, etc.)
// was the whole reason this script exists.
//
// Usage:  node scripts/seed-demo-data.js
// Reads DB connection + owner email from .env / CLI env, same as the app.

require("dotenv").config();
const { Pool } = require("pg");

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || "banelengubane107@gmail.com";

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

let rngState = 42; // fixed seed -> reproducible dataset across re-runs
function rand() {
  // xorshift32 - good enough for demo data, no crypto needs
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
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}
function chance(p) {
  return rand() < p;
}
function jitterDeg() {
  // ~ +/- 0.005-0.03 deg (roughly 500m-3km) so points scatter around a
  // township's centre instead of stacking on one coordinate.
  return (rand() - 0.5) * 0.05;
}
function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

let imgLock = 1000;
function img(keywords) {
  imgLock += 1;
  return `https://loremflickr.com/900/600/${encodeURIComponent(keywords)}?lock=${imgLock}`;
}
function images(keywords, count) {
  return Array.from({ length: count }, () => img(keywords));
}

function fakeWhatsapp() {
  const lead = pick(["6", "7", "8"]);
  let rest = "";
  for (let i = 0; i < 8; i++) rest += randInt(0, 9);
  return `+27${lead}${rest}`;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Areas — township-first spread across all 9 provinces. Coordinates are
// approximate town/suburb centres, accurate enough for demo "near me"
// testing, not survey-grade.
// ---------------------------------------------------------------------------

const AREAS = [
  // Gauteng
  { name: "Soweto", province: "Gauteng", lat: -26.2485, lng: 27.8540 },
  { name: "Alexandra", province: "Gauteng", lat: -26.1076, lng: 28.0961 },
  { name: "Tembisa", province: "Gauteng", lat: -25.9968, lng: 28.2293 },
  { name: "Katlehong", province: "Gauteng", lat: -26.3499, lng: 28.1657 },
  { name: "Vosloorus", province: "Gauteng", lat: -26.3603, lng: 28.1808 },
  { name: "Diepsloot", province: "Gauteng", lat: -25.9309, lng: 27.9989 },
  { name: "Mamelodi", province: "Gauteng", lat: -25.7062, lng: 28.3721 },
  { name: "Atteridgeville", province: "Gauteng", lat: -25.7635, lng: 28.1520 },
  { name: "Soshanguve", province: "Gauteng", lat: -25.5241, lng: 28.1090 },
  { name: "Daveyton", province: "Gauteng", lat: -26.1467, lng: 28.3006 },
  { name: "Kagiso", province: "Gauteng", lat: -26.1500, lng: 27.8333 },
  { name: "Sebokeng", province: "Gauteng", lat: -26.5667, lng: 27.8333 },
  { name: "Bekkersdal", province: "Gauteng", lat: -26.2333, lng: 27.7500 },
  { name: "Ivory Park", province: "Gauteng", lat: -25.9833, lng: 28.2333 },

  // Western Cape
  { name: "Khayelitsha", province: "Western Cape", lat: -34.0389, lng: 18.6725 },
  { name: "Gugulethu", province: "Western Cape", lat: -33.9667, lng: 18.5667 },
  { name: "Nyanga", province: "Western Cape", lat: -33.9333, lng: 18.5833 },
  { name: "Mitchells Plain", province: "Western Cape", lat: -34.0333, lng: 18.6167 },
  { name: "Delft", province: "Western Cape", lat: -33.9667, lng: 18.6667 },
  { name: "Langa", province: "Western Cape", lat: -33.9333, lng: 18.5333 },
  { name: "Philippi", province: "Western Cape", lat: -34.0167, lng: 18.5833 },
  { name: "Kayamandi", province: "Western Cape", lat: -33.9167, lng: 18.8667 },

  // Eastern Cape
  { name: "Mdantsane", province: "Eastern Cape", lat: -32.9333, lng: 27.7167 },
  { name: "Zwide", province: "Eastern Cape", lat: -33.8500, lng: 25.6167 },
  { name: "New Brighton", province: "Eastern Cape", lat: -33.8833, lng: 25.6167 },
  { name: "Motherwell", province: "Eastern Cape", lat: -33.7833, lng: 25.5167 },
  { name: "Duncan Village", province: "Eastern Cape", lat: -32.9833, lng: 27.9167 },
  { name: "KwaZakhele", province: "Eastern Cape", lat: -33.8833, lng: 25.5667 },

  // KwaZulu-Natal
  { name: "Umlazi", province: "KwaZulu-Natal", lat: -29.9667, lng: 30.8833 },
  { name: "KwaMashu", province: "KwaZulu-Natal", lat: -29.7333, lng: 30.9500 },
  { name: "Inanda", province: "KwaZulu-Natal", lat: -29.7000, lng: 30.9167 },
  { name: "Chatsworth", province: "KwaZulu-Natal", lat: -29.9333, lng: 30.8833 },
  { name: "Ntuzuma", province: "KwaZulu-Natal", lat: -29.7333, lng: 30.9167 },
  { name: "Lamontville", province: "KwaZulu-Natal", lat: -29.9333, lng: 30.9667 },

  // Free State
  { name: "Botshabelo", province: "Free State", lat: -29.2500, lng: 26.7167 },
  { name: "Thabong", province: "Free State", lat: -27.9833, lng: 26.7333 },
  { name: "Mangaung", province: "Free State", lat: -29.1167, lng: 26.2167 },
  { name: "Phuthaditjhaba", province: "Free State", lat: -28.5167, lng: 28.8167 },

  // Limpopo
  { name: "Seshego", province: "Limpopo", lat: -23.8667, lng: 29.4000 },
  { name: "Mankweng", province: "Limpopo", lat: -23.8833, lng: 29.7000 },
  { name: "Lebowakgomo", province: "Limpopo", lat: -24.2000, lng: 29.5000 },

  // Mpumalanga
  { name: "KwaMhlanga", province: "Mpumalanga", lat: -25.4667, lng: 28.7000 },
  { name: "Kanyamazane", province: "Mpumalanga", lat: -25.4833, lng: 31.0333 },
  { name: "eMbalenhle", province: "Mpumalanga", lat: -26.5333, lng: 29.0667 },

  // North West
  { name: "Jouberton", province: "North West", lat: -26.9000, lng: 26.6500 },
  { name: "Ikageng", province: "North West", lat: -26.6667, lng: 27.2333 },
  { name: "Tlhabane", province: "North West", lat: -25.6667, lng: 27.2333 },

  // Northern Cape
  { name: "Galeshewe", province: "Northern Cape", lat: -28.7167, lng: 24.7667 },
  { name: "Roodepan", province: "Northern Cape", lat: -28.7333, lng: 24.6833 },
];

// ---------------------------------------------------------------------------
// Business subcategory -> image keywords (loremflickr search terms) + a
// small noun bank used to build varied, plausible business names.
// ---------------------------------------------------------------------------

const SUBCAT_META = {
  // Street & Township Traders
  "spaza-shop": { img: "spaza,convenience,store", noun: "Spaza Shop" },
  "hawker-general-trader": { img: "street,vendor,market", noun: "General Traders" },
  "mai-mai-traditional-traders": { img: "african,market,craft", noun: "Traditional Traders" },
  "airtime-data-vendor": { img: "mobile,phone,airtime", noun: "Airtime & Data" },
  "flea-market-second-hand-trader": { img: "flea,market", noun: "Flea Market" },
  "tailor-seamstress": { img: "tailor,sewing,fabric", noun: "Tailoring" },
  "cobbler-shoe-repair": { img: "shoe,repair,cobbler", noun: "Shoe Repairs" },
  "scrap-metal-dealer": { img: "scrap,metal,junkyard", noun: "Scrap Metal" },

  // Food
  "kota-shisanyama": { img: "shisanyama,braai,meat", noun: "Shisanyama" },
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

  // Beauty
  "hair-salon": { img: "hair,salon,hairdresser", noun: "Hair Salon" },
  "barber": { img: "barber,barbershop,haircut", noun: "Barbershop" },
  "traditional-hair-braiding": { img: "hair,braids,braiding", noun: "Braiding" },
  "weave-extensions": { img: "hair,weave,extensions", noun: "Weave & Extensions" },
  "nails": { img: "nail,manicure,salon", noun: "Nail Bar" },
  "makeup": { img: "makeup,cosmetics,beauty", noun: "Makeup Studio" },
  "eyelashes-brows": { img: "eyelashes,makeup,beauty", noun: "Lashes & Brows" },
  "tattoo-piercing": { img: "tattoo,ink,piercing", noun: "Tattoo Studio" },

  // Events
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

  // Transport & Hire
  "taxi-shuttle-services": { img: "minibus,taxi,transport", noun: "Taxi & Shuttle" },
  "bakkie-hire": { img: "bakkie,pickup,truck", noun: "Bakkie Hire" },
  "scholar-transport": { img: "school,bus,children", noun: "Scholar Transport" },
  "courier-delivery": { img: "delivery,courier,parcel", noun: "Courier" },
  "moving-services": { img: "moving,truck,furniture", noun: "Movers" },
  "trailer-hire": { img: "trailer,towing", noun: "Trailer Hire" },

  // Rentals & Equipment Hire
  "tools-equipment-hire": { img: "tools,hardware,workshop", noun: "Tool Hire" },
  "generator-hire": { img: "generator,power,electricity", noun: "Generator Hire" },
  "furniture-rental": { img: "furniture,sofa,interior", noun: "Furniture Rental" },
  "appliance-rental": { img: "appliance,fridge,kitchen", noun: "Appliance Rental" },
  "venue-hire": { img: "hall,venue,event", noun: "Venue Hire" },
  "scaffolding-hire": { img: "scaffolding,construction", noun: "Scaffolding Hire" },

  // Skilled Trades & Construction
  "handyman": { img: "handyman,tools,repair", noun: "Handyman Services" },
  "carpenters": { img: "carpenter,woodwork,timber", noun: "Carpentry" },
  "painters": { img: "painter,paint,wall", noun: "Painting" },
  "bricklayers": { img: "brick,bricklayer,mason", noun: "Bricklaying" },
  "roofers": { img: "roof,roofing,construction", noun: "Roofing" },
  "tilers": { img: "tile,tiling,floor", noun: "Tiling" },
  "plasterers": { img: "plaster,wall,construction", noun: "Plastering" },
  "welders": { img: "welding,metal,workshop", noun: "Welding" },
  "locksmiths": { img: "lock,key,locksmith", noun: "Locksmith" },
  "fencing-palisade-installation": { img: "fence,palisade,gate", noun: "Fencing" },

  // Shopping
  "second-hand-clothing": { img: "thrift,clothing,secondhand", noun: "Second-Hand Clothing" },
  "traditional-attire": { img: "african,traditional,attire", noun: "Traditional Attire" },
  "clothing": { img: "clothing,fashion,boutique", noun: "Clothing Store" },
  "shoes-accessories": { img: "shoes,sneakers,footwear", noun: "Shoes & Accessories" },
  "printed-t-shirts": { img: "tshirt,printing,apparel", noun: "Printed T-Shirts" },
  "custom-products": { img: "craft,custom,handmade", noun: "Custom Products" },
  "gifts": { img: "gift,present,giftshop", noun: "Gift Shop" },
  "flowers": { img: "flowers,bouquet,florist", noun: "Florist" },

  // Home Services
  "domestic-cleaning": { img: "cleaning,house,domestic", noun: "Domestic Cleaning" },
  "gardening-landscaping": { img: "garden,landscaping,lawn", noun: "Gardening" },
  "security-services": { img: "security,guard,cctv", noun: "Security Services" },
  "laundry-ironing": { img: "laundry,washing,ironing", noun: "Laundry & Ironing" },
  "pest-control": { img: "pest,control,exterminator", noun: "Pest Control" },
  "pool-maintenance": { img: "swimming,pool,maintenance", noun: "Pool Maintenance" },

  // Health & Wellness
  "traditional-healer-sangoma": { img: "traditional,herbs,healer", noun: "Traditional Healer" },
  "clinic-pharmacy": { img: "pharmacy,clinic,medicine", noun: "Clinic & Pharmacy" },
  "spa-massage": { img: "spa,massage,relaxation", noun: "Spa & Massage" },
  "fitness-trainer": { img: "gym,fitness,training", noun: "Fitness Training" },
  "dentist": { img: "dentist,dental,teeth", noun: "Dental Practice" },
  "optometrist": { img: "glasses,optometry,eyewear", noun: "Optometrist" },

  // Professional Services
  "electricians": { img: "electrician,wiring,electrical", noun: "Electrical Services" },
  "plumbers": { img: "plumber,pipes,plumbing", noun: "Plumbing" },
  "tutors": { img: "tutor,study,books", noun: "Tutoring" },
  "notary-home-affairs-assistance": { img: "office,documents,paperwork", noun: "Home Affairs Assistance" },
  "translators": { img: "translation,language,books", noun: "Translation Services" },
  "accountants-bookkeepers": { img: "accounting,finance,office", noun: "Accounting" },
  "insurance-brokers": { img: "insurance,office,meeting", noun: "Insurance Brokers" },
  "lawyers": { img: "law,justice,office", noun: "Legal Services" },

  // Automotive
  "car-wash-valet": { img: "carwash,car,valet", noun: "Car Wash" },
  "mechanics": { img: "mechanic,garage,engine", noun: "Mechanics" },
  "tyre-fitment": { img: "tyre,wheel,car", noun: "Tyre Fitment" },
  "panel-beating-spray-painting": { img: "spraypaint,car,bodywork", noun: "Panel Beating" },
  "auto-electricians": { img: "car,electrical,engine", noun: "Auto Electrical" },
  "towing-services": { img: "towtruck,tow,breakdown", noun: "Towing Services" },
  "scrap-yard-spares": { img: "junkyard,carparts,scrapyard", noun: "Scrap Yard & Spares" },

  // Tech & Repairs
  "phone-repair": { img: "phone,repair,smartphone", noun: "Phone Repairs" },
  "phone-accessories-vendor": { img: "phone,accessories,case", noun: "Phone Accessories" },
  "appliance-repair": { img: "appliance,repair,kitchen", noun: "Appliance Repairs" },
  "tv-electronics-repair": { img: "television,electronics,repair", noun: "TV & Electronics Repair" },
  "laptop-computer-repair": { img: "laptop,computer,repair", noun: "Computer Repairs" },
  "wifi-network-installation": { img: "wifi,router,network", noun: "WiFi Installation" },
  "cctv-alarm-installation": { img: "cctv,camera,security", noun: "CCTV & Alarms" },
  "printer-cartridge-refill": { img: "printer,ink,office", noun: "Printer & Cartridge Refill" },
  "it-support": { img: "computer,office,it", noun: "IT Support" },

  // Education & Training
  "creche-ecd": { img: "kindergarten,children,preschool", noun: "Creche" },
  "driving-school": { img: "driving,car,lesson", noun: "Driving School" },
  "skills-artisan-training": { img: "training,workshop,skills", noun: "Skills Training" },
  "computer-literacy-classes": { img: "computer,classroom,training", noun: "Computer Classes" },
  "music-lessons": { img: "music,piano,guitar", noun: "Music Lessons" },

  // Pets & Animals
  "veterinary-services": { img: "vet,animal,clinic", noun: "Veterinary Services" },
  "pet-shop": { img: "pet,shop,animal", noun: "Pet Shop" },
  "pet-grooming": { img: "dog,grooming,pet", noun: "Pet Grooming" },
  "pet-sitting-dog-walking": { img: "dog,walking,pet", noun: "Pet Sitting" },

  // Online Services
  "digital-products": { img: "laptop,digital,design", noun: "Digital Products" },
  "social-media-management": { img: "smartphone,social,media", noun: "Social Media Management" },
  "graphic-design": { img: "design,graphic,creative", noun: "Graphic Design" },
  "web-design-development": { img: "website,code,laptop", noun: "Web Design" },
  "cv-writing-career-coaching": { img: "resume,office,writing", noun: "CV Writing" },
  "content-writing-copywriting": { img: "writing,laptop,notebook", noun: "Copywriting" },
  "virtual-assistant-admin-support": { img: "office,laptop,desk", noun: "Virtual Assistant" },
  "data-entry-research": { img: "spreadsheet,office,laptop", noun: "Data Entry" },

  // Other
  "general": { img: "shop,storefront,business", noun: "General Services" },
};

// Only these subcategories are plausible as businessType "online" (no
// physical shopfront). Everything else always gets a real township
// location so "physical" listings remain the overwhelming majority.
const ONLINE_ELIGIBLE = new Set([
  "digital-products", "social-media-management", "graphic-design",
  "web-design-development", "cv-writing-career-coaching",
  "content-writing-copywriting", "virtual-assistant-admin-support",
  "data-entry-research", "printed-t-shirts", "custom-products",
  "gifts", "translators", "tutors", "it-support", "computer-literacy-classes",
]);

// Subcategories a fresh graduate plausibly fills with a qualification
// rather than years of trading history — these get a real chance of
// showing the "credential" trust-signal badge. Grouped so the credential
// text picked actually matches what the subcategory would need.
const CREDENTIAL_POOLS = {
  tutors: ["BSc Mathematics Graduate", "BEd Honours Graduate", "Final-year Engineering Student", "BCom Economics Graduate"],
  "accountants-bookkeepers": ["BCom Accounting Graduate", "SAIPA Certified Bookkeeper", "Final-year Accounting Student"],
  "notary-home-affairs-assistance": ["LLB Law Graduate", "Paralegal Diploma Graduate"],
  translators: ["BA Languages Graduate", "SATI Accredited Translator"],
  "insurance-brokers": ["BCom Risk Management Graduate", "RE5 Certified"],
  lawyers: ["LLB Law Graduate (Candidate Attorney)"],
  "creche-ecd": ["National Diploma: Early Childhood Development", "BEd Foundation Phase Graduate"],
  "computer-literacy-classes": ["National Diploma: IT", "BSc Computer Science Graduate"],
  "music-lessons": ["Trinity College Music Diploma", "BMus Graduate"],
  "skills-artisan-training": ["National Diploma: Engineering", "Red Seal Certified Artisan"],
  "digital-products": ["BSc Computer Science Graduate", "Diploma in Software Development"],
  "social-media-management": ["BA Communication Science Graduate", "Diploma in Marketing"],
  "graphic-design": ["Diploma in Graphic Design", "BA Visual Arts Graduate"],
  "web-design-development": ["National Diploma: IT (Software Development)", "BSc Computer Science Graduate"],
  "cv-writing-career-coaching": ["BA Industrial Psychology Graduate", "HR Management Graduate"],
  "content-writing-copywriting": ["BA English Graduate", "BA Journalism Graduate"],
  "virtual-assistant-admin-support": ["National Diploma: Business Administration", "BCom Graduate"],
  "data-entry-research": ["BCom Statistics Graduate", "BSc Graduate"],
  "it-support": ["A+ / N+ Certified", "National Diploma: IT"],
};

const FIRST_NAMES = ["Thabo", "Nomvula", "Sipho", "Zanele", "Andile", "Precious",
  "Bongani", "Lindiwe", "Kagiso", "Palesa", "Tshepo", "Nokuthula", "Mpho",
  "Bandile", "Ayanda", "Refilwe", "Sibusiso", "Nomsa", "Lerato", "Vusi"];
const SURNAMES = ["Mokoena", "Dlamini", "Nkosi", "Khumalo", "Mahlangu",
  "Ndlovu", "Sithole", "Radebe", "Mabaso", "Zulu", "Molefe", "Tshabalala",
  "Maseko", "Ngcobo", "Mkhize"];

function ownerName() {
  return `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
}

const BIZ_NAME_TEMPLATES = [
  (area, noun) => `${area} ${noun}`,
  (area, noun) => `${noun} ${area}`,
  (area, noun, owner) => `${owner}'s ${noun}`,
  (area, noun) => `${area} ${noun} Hub`,
  (area, noun) => `Royal ${noun} - ${area}`,
  (area, noun) => `${noun} Corner ${area}`,
];

const BIZ_DESC_EXTRAS = [
  "Affordable prices and friendly service.",
  "Same-day service available on request.",
  "Contact us on WhatsApp to place an order or book a slot.",
  "Trusted by the local community for years.",
  "Open six days a week.",
  "Quality work, no shortcuts.",
  "Walk-ins welcome, or book ahead.",
];

const STREET_NAMES = ["Church", "Main", "Nelson Mandela", "Vilakazi",
  "Market", "Station", "School", "Kopanong", "Freedom", "Sisulu",
  "Khumalo", "Union", "Thabo Mbeki", "Dube", "Moshoeshoe"];
const STREET_TYPES = ["Street", "Road", "Avenue", "Drive", "Way"];

function randomAddress(area) {
  return `${randInt(1, 300)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}, ${area.name}`;
}

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
  return {
    monday: weekday, tuesday: weekday, wednesday: weekday,
    thursday: weekday, friday: weekday, saturday: sat, sunday: sun,
  };
}

const PRICE_RANGES = ["$", "$", "$", "$$", "$$", "$$$", "$$$$"]; // weighted cheap

// ---------------------------------------------------------------------------
// Room categories/property types -> image keywords
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

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function main() {
  const client = await pool.connect();
  try {
    const ownerRes = await client.query('SELECT id FROM "user" WHERE email = $1', [OWNER_EMAIL]);
    if (ownerRes.rowCount === 0) {
      throw new Error(`No user found with email ${OWNER_EMAIL} - create the account first.`);
    }
    const ownerId = ownerRes.rows[0].id;
    console.log(`Owner: ${OWNER_EMAIL} (id ${ownerId})`);

    const subcatRes = await client.query(`
      SELECT s.id, s.slug AS "subSlug", s."categoryId", c.slug AS "catSlug"
      FROM business_subcategories s
      JOIN business_categories c ON c.id = s."categoryId"
    `);
    const subcatBySlug = new Map(subcatRes.rows.map((r) => [r.subSlug, r]));
    const allSubSlugs = [...subcatBySlug.keys()];
    console.log(`Loaded ${allSubSlugs.length} subcategories.`);

    console.log("Clearing existing businesses, rooms, gigs...");
    await client.query("TRUNCATE TABLE businesses RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE room RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE gigs RESTART IDENTITY CASCADE");

    // --- ROOMS ---------------------------------------------------------
    const ROOMS_PER_AREA = 5;
    let roomCount = 0;
    for (const area of AREAS) {
      for (let i = 0; i < ROOMS_PER_AREA; i++) {
        const cat = pick(ROOM_CATS);
        const bedrooms = randInt(cat.bedrooms[0], cat.bedrooms[1]);
        const bathrooms = Math.max(1, Math.min(bedrooms, randInt(1, 3)));
        const size = randInt(cat.size[0], cat.size[1]);
        const price = randInt(cat.price[0], cat.price[1]);
        const name = pick(ROOM_NAME_TEMPLATES)(cat.name, area.name);
        const description = `${cat.name} available to rent in ${area.name}, ${area.province}. ` +
          `${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}, ${bathrooms} bathroom${bathrooms > 1 ? "s" : ""}, ${size}m². ` +
          `${pick(ROOM_DESC_EXTRAS)} ${pick(ROOM_DESC_EXTRAS)}`;

        const location = {
          address: randomAddress(area),
          area: area.name,
          lat: round(area.lat + jitterDeg(), 6),
          lng: round(area.lng + jitterDeg(), 6),
        };

        await client.query(
          `INSERT INTO room
            (name, category, price, location, description, bedrooms, bathrooms, size,
             furnished, wifi, parking, "electricityIncluded", "waterIncluded", "petsAllowed",
             kitchen, "diningArea", "livingRoom", balcony, "smokingAllowed",
             "propertyType", "availableFrom", deposit, "leaseTerm",
             rating, "reviewCount", "reportCount", images, videos, reviews, "ownerId", status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)`,
          [
            name, cat.name, price, JSON.stringify(location), description, bedrooms, bathrooms, size,
            chance(0.4), chance(0.55), chance(0.45), chance(0.35), chance(0.45), chance(0.3),
            chance(0.5), chance(0.3), chance(0.4), chance(0.2), false,
            pick(PROPERTY_TYPES), daysFromNow(randInt(0, 21)), price, pick(LEASE_TERMS),
            chance(0.35) ? round(3.5 + rand() * 1.5, 1) : 0,
            chance(0.35) ? randInt(1, 45) : 0,
            0, images(cat.img, randInt(2, 4)).join(","), null, "[]", ownerId, "active",
          ],
        );
        roomCount++;
      }
    }
    console.log(`Inserted ${roomCount} rooms across ${AREAS.length} areas.`);

    // --- BUSINESSES ------------------------------------------------------
    const AREAS_PER_SUBCAT = 6;
    let bizCount = 0;
    for (const subSlug of allSubSlugs) {
      const meta = SUBCAT_META[subSlug] || { img: "shop,storefront", noun: subSlug.replace(/-/g, " ") };
      const sub = subcatBySlug.get(subSlug);
      const chosenAreas = pickN(AREAS, AREAS_PER_SUBCAT);

      for (const area of chosenAreas) {
        const owner = ownerName();
        const name = pick(BIZ_NAME_TEMPLATES)(area.name, meta.noun, owner);
        const isOnline = ONLINE_ELIGIBLE.has(subSlug) && chance(0.35);
        const description = `${meta.noun} serving ${area.name}${isOnline ? "" : ` and surrounding ${area.province} areas`}. ` +
          `${pick(BIZ_DESC_EXTRAS)} ${pick(BIZ_DESC_EXTRAS)}`;

        const location = isOnline ? null : {
          address: randomAddress(area),
          area: area.name,
          lat: round(area.lat + jitterDeg(), 6),
          lng: round(area.lng + jitterDeg(), 6),
        };

        const supportsDelivery = !isOnline && chance(0.4);
        const supportsWhatsAppOrder = chance(0.75);
        const rating = chance(0.45) ? round(3.3 + rand() * 1.7, 1) : 0;
        const reviewCount = rating > 0 ? randInt(1, 60) : 0;
        const credentialPool = CREDENTIAL_POOLS[subSlug];
        const credential = credentialPool && chance(0.5) ? pick(credentialPool) : null;

        await client.query(
          `INSERT INTO businesses
            ("externalId", name, credential, rating, "reviewCount", location, description, images,
             "operatingHours", "ownerId", "businessType", "supportsDelivery", "supportsWhatsAppOrder",
             "whatsappNumber", "priceRange", "categoryId", "subcategoryId", videos, "reportCount", status)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            name, credential, rating, reviewCount, location ? JSON.stringify(location) : null, description,
            images(meta.img, randInt(2, 4)).join(","), JSON.stringify(operatingHoursFor(!isOnline)),
            ownerId, isOnline ? "online" : "physical", supportsDelivery, supportsWhatsAppOrder,
            supportsWhatsAppOrder ? fakeWhatsapp() : null, pick(PRICE_RANGES),
            sub.categoryId, sub.id, null, 0, "active",
          ],
        );
        bizCount++;
      }
    }
    console.log(`Inserted ${bizCount} businesses across ${allSubSlugs.length} subcategories.`);

    // --- GIGS --------------------------------------------------------------
    const GIGS_PER_AREA = 4;
    const URGENCIES = ["flexible", "flexible", "flexible", "this_week", "this_week", "today"];
    let gigCount = 0;
    for (const area of AREAS) {
      for (let i = 0; i < GIGS_PER_AREA; i++) {
        const subSlug = pick(allSubSlugs);
        const meta = SUBCAT_META[subSlug] || { noun: subSlug.replace(/-/g, " ") };
        const sub = subcatBySlug.get(subSlug);
        const type = chance(0.5) ? "need_help" : "offering_work";
        const title = type === "need_help"
          ? `Need ${meta.noun} in ${area.name}`
          : `Offering ${meta.noun} services in ${area.name}`;
        const description = type === "need_help"
          ? `Looking for someone to help with ${meta.noun.toLowerCase()} in ${area.name}. ${pick(BIZ_DESC_EXTRAS)}`
          : `Available for ${meta.noun.toLowerCase()} work around ${area.name}. ${pick(BIZ_DESC_EXTRAS)}`;

        const urgency = pick(URGENCIES);
        const ttlDays = urgency === "today" ? 1 : urgency === "this_week" ? 7 : 30;
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

        const location = {
          address: randomAddress(area),
          area: area.name,
          lat: round(area.lat + jitterDeg(), 6),
          lng: round(area.lng + jitterDeg(), 6),
        };

        const hasPrice = chance(0.6);

        await client.query(
          `INSERT INTO gigs
            (type, title, description, price, "priceType", urgency, "expiresAt",
             location, "whatsappNumber", "reportCount", status, "ownerId", "categoryId", "subcategoryId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            type, title, description, hasPrice ? randInt(100, 3000) : null,
            hasPrice ? pick(["fixed", "hourly", "negotiable"]) : "negotiable",
            urgency, expiresAt, JSON.stringify(location), fakeWhatsapp(), 0, "active",
            ownerId, sub.categoryId, sub.id,
          ],
        );
        gigCount++;
      }
    }
    console.log(`Inserted ${gigCount} gigs across ${AREAS.length} areas.`);

    console.log("\nDone.");
    console.log(`Totals: ${roomCount} rooms, ${bizCount} businesses, ${gigCount} gigs, spanning ${AREAS.length} areas in ${new Set(AREAS.map(a => a.province)).size} provinces.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
