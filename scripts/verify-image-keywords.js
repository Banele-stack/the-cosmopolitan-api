// Checks every loremflickr keyword combo used for seed images against the
// live service and flags any that fall back to its random "defaultImage"
// (i.e. zero real Flickr photos matched all the tags — this is exactly how
// a "spaza-shop" listing ends up showing an unrelated cat statue with cars
// in the background). Prints a report; doesn't modify anything.
//
// Usage: node scripts/verify-image-keywords.js

const https = require("https");

function resolveFinalUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(resolveFinalUrl(next, redirectsLeft - 1));
        } else {
          res.resume();
          resolve(url);
        }
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function check(name, keywords, attempt = 1) {
  const encoded = encodeURIComponent(keywords);
  const url = `https://loremflickr.com/900/600/${encoded}?lock=${Math.floor(Math.random() * 1000000)}`;
  try {
    const final = await resolveFinalUrl(url);
    const isFallback = final.includes("defaultImage");
    return { name, keywords, ok: !isFallback, final };
  } catch (err) {
    if (attempt < 3) {
      await sleep(500 * attempt);
      return check(name, keywords, attempt + 1);
    }
    return { name, keywords, ok: false, final: `ERROR: ${err.message || err.code || "unknown"}` };
  }
}

const ROOM_CATS = {
  Apartment: "apartment,building",
  Room: "bedroom,room",
  Bachelor: "studio,apartment",
  House: "house,exterior",
  "Guest House": "guesthouse,bnb",
  "Student Accommodation": "dorm,student,room",
};

const SUBCAT_META = {
  "spaza-shop": "spaza,convenience,store",
  "hawker-general-trader": "street,vendor,market",
  "mai-mai-traditional-traders": "african,market,craft",
  "airtime-data-vendor": "mobile,phone,airtime",
  "flea-market-second-hand-trader": "flea,market",
  "tailor-seamstress": "tailor,sewing,fabric",
  "cobbler-shoe-repair": "shoe,repair,cobbler",
  "scrap-metal-dealer": "scrap,metal,junkyard",
  "kota-shisanyama": "shisanyama,braai,meat",
  "street-food-vendor": "street,food,vendor",
  "braai-grill": "braai,barbecue,grill",
  "fruit-veg-stand": "fruit,vegetables,market",
  "restaurants": "restaurant,dining,food",
  "bakery": "bakery,bread,pastries",
  "lunch-box-packages": "lunchbox,food,meal",
  "catering": "catering,buffet,event,food",
  "meat-packages": "meat,butcher,beef",
  "snacks": "snacks,chips,crisps",
  "treats": "cupcakes,dessert,sweets",
  "hair-salon": "hair,salon,hairdresser",
  "barber": "barber,barbershop,haircut",
  "traditional-hair-braiding": "hair,braids,braiding",
  "weave-extensions": "hair,weave,extensions",
  "nails": "nail,manicure,salon",
  "makeup": "makeup,cosmetics,beauty",
  "eyelashes-brows": "eyelashes,makeup,beauty",
  "tattoo-piercing": "tattoo,ink,piercing",
  "djs": "dj,turntable,music",
  "sound-equipment": "speaker,sound,audio",
  "tents": "tent,marquee,event",
  "chairs": "chairs,event,seating",
  "decor": "event,decor,flowers",
  "kiddies-party-packages": "kids,birthday,party",
  "balloon-packages": "balloons,party,decoration",
  "mcs-hosts": "microphone,host,stage",
  "photographers": "camera,photographer,photo",
  "wedding-planners": "wedding,bride,ceremony",
  "taxi-shuttle-services": "minibus,taxi,transport",
  "bakkie-hire": "bakkie,pickup,truck",
  "scholar-transport": "school,bus,children",
  "courier-delivery": "delivery,courier,parcel",
  "moving-services": "moving,truck,furniture",
  "trailer-hire": "trailer,towing",
  "tools-equipment-hire": "tools,hardware,workshop",
  "generator-hire": "generator,power,electricity",
  "furniture-rental": "furniture,sofa,interior",
  "appliance-rental": "appliance,fridge,kitchen",
  "venue-hire": "hall,venue,event",
  "scaffolding-hire": "scaffolding,construction",
  "handyman": "handyman,tools,repair",
  "carpenters": "carpenter,woodwork,timber",
  "painters": "painter,paint,wall",
  "bricklayers": "brick,bricklayer,mason",
  "roofers": "roof,roofing,construction",
  "tilers": "tile,tiling,floor",
  "plasterers": "plaster,wall,construction",
  "welders": "welding,metal,workshop",
  "locksmiths": "lock,key,locksmith",
  "fencing-palisade-installation": "fence,palisade,gate",
  "second-hand-clothing": "thrift,clothing,secondhand",
  "traditional-attire": "african,traditional,attire",
  "clothing": "clothing,fashion,boutique",
  "shoes-accessories": "shoes,sneakers,footwear",
  "printed-t-shirts": "tshirt,printing,apparel",
  "custom-products": "craft,custom,handmade",
  "gifts": "gift,present,giftshop",
  "flowers": "flowers,bouquet,florist",
  "domestic-cleaning": "cleaning,house,domestic",
  "gardening-landscaping": "garden,landscaping,lawn",
  "security-services": "security,guard,cctv",
  "laundry-ironing": "laundry,washing,ironing",
  "pest-control": "pest,control,exterminator",
  "pool-maintenance": "swimming,pool,maintenance",
  "traditional-healer-sangoma": "traditional,herbs,healer",
  "clinic-pharmacy": "pharmacy,clinic,medicine",
  "spa-massage": "spa,massage,relaxation",
  "fitness-trainer": "gym,fitness,training",
  "dentist": "dentist,dental,teeth",
  "optometrist": "glasses,optometry,eyewear",
  "electricians": "electrician,wiring,electrical",
  "plumbers": "plumber,pipes,plumbing",
  "tutors": "tutor,study,books",
  "notary-home-affairs-assistance": "office,documents,paperwork",
  "translators": "translation,language,books",
  "accountants-bookkeepers": "accounting,finance,office",
  "insurance-brokers": "insurance,office,meeting",
  "lawyers": "law,justice,office",
  "car-wash-valet": "carwash,car,valet",
  "mechanics": "mechanic,garage,engine",
  "tyre-fitment": "tyre,wheel,car",
  "panel-beating-spray-painting": "spraypaint,car,bodywork",
  "auto-electricians": "car,electrical,engine",
  "towing-services": "towtruck,tow,breakdown",
  "scrap-yard-spares": "junkyard,carparts,scrapyard",
  "phone-repair": "phone,repair,smartphone",
  "phone-accessories-vendor": "phone,accessories,case",
  "appliance-repair": "appliance,repair,kitchen",
  "tv-electronics-repair": "television,electronics,repair",
  "laptop-computer-repair": "laptop,computer,repair",
  "wifi-network-installation": "wifi,router,network",
  "cctv-alarm-installation": "cctv,camera,security",
  "printer-cartridge-refill": "printer,ink,office",
  "it-support": "computer,office,it",
  "creche-ecd": "kindergarten,children,preschool",
  "driving-school": "driving,car,lesson",
  "skills-artisan-training": "training,workshop,skills",
  "computer-literacy-classes": "computer,classroom,training",
  "music-lessons": "music,piano,guitar",
  "veterinary-services": "vet,animal,clinic",
  "pet-shop": "pet,shop,animal",
  "pet-grooming": "dog,grooming,pet",
  "pet-sitting-dog-walking": "dog,walking,pet",
  "digital-products": "laptop,digital,design",
  "social-media-management": "smartphone,social,media",
  "graphic-design": "design,graphic,creative",
  "web-design-development": "website,code,laptop",
  "cv-writing-career-coaching": "resume,office,writing",
  "content-writing-copywriting": "writing,laptop,notebook",
  "virtual-assistant-admin-support": "office,laptop,desk",
  "data-entry-research": "spreadsheet,office,laptop",
  "general": "shop,storefront,business",
};

async function main() {
  const all = [
    ...Object.entries(ROOM_CATS).map(([name, kw]) => ["ROOM:" + name, kw]),
    ...Object.entries(SUBCAT_META).map(([name, kw]) => ["BIZ:" + name, kw]),
  ];

  const results = [];
  // Small concurrency batch to avoid hammering the service.
  const BATCH = 3;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(([name, kw]) => check(name, kw)));
    results.push(...batchResults);
    process.stderr.write(`checked ${Math.min(i + BATCH, all.length)}/${all.length}\n`);
    await sleep(200);
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length} total, ${bad.length} FAILED (fell back to defaultImage or errored):\n`);
  bad.forEach((r) => console.log(`  ${r.name}: "${r.keywords}" -> ${r.final}`));
  console.log(`\n${results.length - bad.length} OK.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
