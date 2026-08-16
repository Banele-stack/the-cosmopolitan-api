export interface BusinessCategorySeedSubcategory {
  name: string;
  slug: string;
  sortOrder: number;
}

export interface BusinessCategorySeedEntry {
  name: string;
  slug: string;
  sortOrder: number;
  subcategories: BusinessCategorySeedSubcategory[];
}

// Canonical, exhaustive category tree. The seeder (see
// BusinessCategoryService.seed) is additive-only: entries here are matched
// against the database by slug, and anything missing gets created. Existing
// rows — including ones not listed here — are never renamed or removed.
//
// Ordering (both the category list and each category's own subcategory
// list): Events, Beauty, and Food lead as the highest-intent, most-browsed
// categories, so they're what a user sees first without scrolling or
// expanding "more". After those three, the rest stays
// township/local-economy-first as before: everyday informal trade and
// daily-need services lead, formal/occasional/online-only services trail.
// "Other" always stays last as a catch-all. Transport & Hire and Rentals &
// Equipment Hire are kept adjacent (hiring/equipment is one conceptual
// group).
//
// Each subcategory should describe exactly one thing, once, in whichever
// category is its most natural home. In particular: don't add an
// "-online" twin of something that already exists elsewhere — whether a
// business is online-only is the separate businessType/onlineOnly filter,
// not a category of its own. Before adding a new subcategory, check it
// isn't already covered under a different name.
export const BUSINESS_CATEGORY_SEED: BusinessCategorySeedEntry[] = [
  {
    name: 'Street & Township Traders',
    slug: 'street-and-township-traders',
    sortOrder: 3,
    subcategories: [
      { name: 'Spaza Shop', slug: 'spaza-shop', sortOrder: 0 },
      {
        name: 'Hawker & General Trader',
        slug: 'hawker-general-trader',
        sortOrder: 1,
      },
      {
        name: 'Mai Mai Traditional Traders',
        slug: 'mai-mai-traditional-traders',
        sortOrder: 2,
      },
      {
        name: 'Airtime & Data Vendor',
        slug: 'airtime-data-vendor',
        sortOrder: 3,
      },
      {
        name: 'Flea Market & Second-Hand Trader',
        slug: 'flea-market-second-hand-trader',
        sortOrder: 4,
      },
      { name: 'Tailor & Seamstress', slug: 'tailor-seamstress', sortOrder: 5 },
      {
        name: 'Cobbler & Shoe Repair',
        slug: 'cobbler-shoe-repair',
        sortOrder: 6,
      },
      {
        name: 'Scrap Metal Dealer',
        slug: 'scrap-metal-dealer',
        sortOrder: 7,
      },
    ],
  },
  {
    name: 'Food',
    slug: 'food',
    sortOrder: 2,
    subcategories: [
      { name: 'Kota & Shisanyama', slug: 'kota-shisanyama', sortOrder: 0 },
      {
        name: 'Street Food Vendor',
        slug: 'street-food-vendor',
        sortOrder: 1,
      },
      { name: 'Braai & Grill', slug: 'braai-grill', sortOrder: 2 },
      { name: 'Fruit & Veg Stand', slug: 'fruit-veg-stand', sortOrder: 3 },
      { name: 'Restaurants', slug: 'restaurants', sortOrder: 4 },
      { name: 'Bakery', slug: 'bakery', sortOrder: 5 },
      {
        name: 'Lunch Box Packages',
        slug: 'lunch-box-packages',
        sortOrder: 6,
      },
      { name: 'Catering', slug: 'catering', sortOrder: 7 },
      { name: 'Meat Packages', slug: 'meat-packages', sortOrder: 8 },
      { name: 'Snacks', slug: 'snacks', sortOrder: 9 },
      { name: 'Treats', slug: 'treats', sortOrder: 10 },
    ],
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    sortOrder: 1,
    subcategories: [
      { name: 'Hair Salon', slug: 'hair-salon', sortOrder: 0 },
      { name: 'Barber', slug: 'barber', sortOrder: 1 },
      {
        name: 'Traditional Hair Braiding',
        slug: 'traditional-hair-braiding',
        sortOrder: 2,
      },
      { name: 'Weave & Extensions', slug: 'weave-extensions', sortOrder: 3 },
      { name: 'Nails', slug: 'nails', sortOrder: 4 },
      { name: 'Makeup', slug: 'makeup', sortOrder: 5 },
      { name: 'Eyelashes & Brows', slug: 'eyelashes-brows', sortOrder: 6 },
      { name: 'Tattoo & Piercing', slug: 'tattoo-piercing', sortOrder: 7 },
    ],
  },
  {
    name: 'Events',
    slug: 'events',
    sortOrder: 0,
    subcategories: [
      { name: 'DJs', slug: 'djs', sortOrder: 0 },
      { name: 'Sound Equipment', slug: 'sound-equipment', sortOrder: 1 },
      { name: 'Tents', slug: 'tents', sortOrder: 2 },
      { name: 'Chairs', slug: 'chairs', sortOrder: 3 },
      { name: 'Decor', slug: 'decor', sortOrder: 4 },
      {
        name: 'Kiddies Party Packages',
        slug: 'kiddies-party-packages',
        sortOrder: 5,
      },
      { name: 'Balloon Packages', slug: 'balloon-packages', sortOrder: 6 },
      { name: 'MCs & Hosts', slug: 'mcs-hosts', sortOrder: 7 },
      { name: 'Photographers', slug: 'photographers', sortOrder: 8 },
      { name: 'Wedding Planners', slug: 'wedding-planners', sortOrder: 9 },
    ],
  },
  {
    name: 'Transport & Hire',
    slug: 'transport-and-hire',
    sortOrder: 4,
    subcategories: [
      {
        name: 'Taxi & Shuttle Services',
        slug: 'taxi-shuttle-services',
        sortOrder: 0,
      },
      { name: 'Bakkie Hire', slug: 'bakkie-hire', sortOrder: 1 },
      { name: 'Scholar Transport', slug: 'scholar-transport', sortOrder: 2 },
      {
        name: 'Courier & Delivery',
        slug: 'courier-delivery',
        sortOrder: 3,
      },
      { name: 'Moving Services', slug: 'moving-services', sortOrder: 4 },
      { name: 'Trailer Hire', slug: 'trailer-hire', sortOrder: 5 },
    ],
  },
  {
    name: 'Rentals & Equipment Hire',
    slug: 'rentals-and-equipment-hire',
    sortOrder: 5,
    subcategories: [
      {
        name: 'Tools & Equipment Hire',
        slug: 'tools-equipment-hire',
        sortOrder: 0,
      },
      { name: 'Generator Hire', slug: 'generator-hire', sortOrder: 1 },
      { name: 'Furniture Rental', slug: 'furniture-rental', sortOrder: 2 },
      { name: 'Appliance Rental', slug: 'appliance-rental', sortOrder: 3 },
      { name: 'Venue Hire', slug: 'venue-hire', sortOrder: 4 },
      {
        name: 'Scaffolding Hire',
        slug: 'scaffolding-hire',
        sortOrder: 5,
      },
    ],
  },
  {
    name: 'Skilled Trades & Construction',
    slug: 'skilled-trades-and-construction',
    sortOrder: 6,
    subcategories: [
      { name: 'Handyman', slug: 'handyman', sortOrder: 0 },
      { name: 'Carpenters', slug: 'carpenters', sortOrder: 1 },
      { name: 'Painters', slug: 'painters', sortOrder: 2 },
      { name: 'Bricklayers', slug: 'bricklayers', sortOrder: 3 },
      { name: 'Roofers', slug: 'roofers', sortOrder: 4 },
      { name: 'Tilers', slug: 'tilers', sortOrder: 5 },
      { name: 'Plasterers', slug: 'plasterers', sortOrder: 6 },
      { name: 'Welders', slug: 'welders', sortOrder: 7 },
      { name: 'Locksmiths', slug: 'locksmiths', sortOrder: 8 },
      {
        name: 'Fencing & Palisade Installation',
        slug: 'fencing-palisade-installation',
        sortOrder: 9,
      },
    ],
  },
  {
    name: 'Shopping',
    slug: 'shopping',
    sortOrder: 7,
    subcategories: [
      {
        name: 'Second-Hand Clothing',
        slug: 'second-hand-clothing',
        sortOrder: 0,
      },
      { name: 'Traditional Attire', slug: 'traditional-attire', sortOrder: 1 },
      { name: 'Clothing', slug: 'clothing', sortOrder: 2 },
      {
        name: 'Shoes & Accessories',
        slug: 'shoes-accessories',
        sortOrder: 3,
      },
      { name: 'Printed T-Shirts', slug: 'printed-t-shirts', sortOrder: 4 },
      { name: 'Custom Products', slug: 'custom-products', sortOrder: 5 },
      { name: 'Gifts', slug: 'gifts', sortOrder: 6 },
      { name: 'Flowers', slug: 'flowers', sortOrder: 7 },
    ],
  },
  {
    name: 'Home Services',
    slug: 'home-services',
    sortOrder: 8,
    subcategories: [
      {
        name: 'Domestic Cleaning',
        slug: 'domestic-cleaning',
        sortOrder: 0,
      },
      {
        name: 'Gardening & Landscaping',
        slug: 'gardening-landscaping',
        sortOrder: 1,
      },
      { name: 'Security Services', slug: 'security-services', sortOrder: 2 },
      { name: 'Laundry & Ironing', slug: 'laundry-ironing', sortOrder: 3 },
      { name: 'Pest Control', slug: 'pest-control', sortOrder: 4 },
      { name: 'Pool Maintenance', slug: 'pool-maintenance', sortOrder: 5 },
    ],
  },
  {
    name: 'Health & Wellness',
    slug: 'health-and-wellness',
    sortOrder: 9,
    subcategories: [
      {
        name: 'Traditional Healer / Sangoma',
        slug: 'traditional-healer-sangoma',
        sortOrder: 0,
      },
      { name: 'Clinic & Pharmacy', slug: 'clinic-pharmacy', sortOrder: 1 },
      { name: 'Spa & Massage', slug: 'spa-massage', sortOrder: 2 },
      { name: 'Fitness Trainer', slug: 'fitness-trainer', sortOrder: 3 },
      { name: 'Dentist', slug: 'dentist', sortOrder: 4 },
      { name: 'Optometrist', slug: 'optometrist', sortOrder: 5 },
    ],
  },
  {
    name: 'Professional Services',
    slug: 'professional-services',
    sortOrder: 10,
    subcategories: [
      { name: 'Electricians', slug: 'electricians', sortOrder: 0 },
      { name: 'Plumbers', slug: 'plumbers', sortOrder: 1 },
      { name: 'Tutors', slug: 'tutors', sortOrder: 2 },
      {
        name: 'Notary & Home Affairs Assistance',
        slug: 'notary-home-affairs-assistance',
        sortOrder: 3,
      },
      { name: 'Translators', slug: 'translators', sortOrder: 4 },
      {
        name: 'Accountants & Bookkeepers',
        slug: 'accountants-bookkeepers',
        sortOrder: 5,
      },
      {
        name: 'Insurance Brokers',
        slug: 'insurance-brokers',
        sortOrder: 6,
      },
      { name: 'Lawyers', slug: 'lawyers', sortOrder: 7 },
    ],
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    sortOrder: 11,
    subcategories: [
      {
        name: 'Car Wash & Valet',
        slug: 'car-wash-valet',
        sortOrder: 0,
      },
      { name: 'Mechanics', slug: 'mechanics', sortOrder: 1 },
      { name: 'Tyre Fitment', slug: 'tyre-fitment', sortOrder: 2 },
      {
        name: 'Panel Beating & Spray Painting',
        slug: 'panel-beating-spray-painting',
        sortOrder: 3,
      },
      {
        name: 'Auto Electricians',
        slug: 'auto-electricians',
        sortOrder: 4,
      },
      { name: 'Towing Services', slug: 'towing-services', sortOrder: 5 },
      {
        name: 'Scrap Yard & Spares',
        slug: 'scrap-yard-spares',
        sortOrder: 6,
      },
    ],
  },
  {
    name: 'Tech & Repairs',
    slug: 'tech-and-repairs',
    sortOrder: 12,
    subcategories: [
      { name: 'Phone Repair', slug: 'phone-repair', sortOrder: 0 },
      {
        name: 'Phone Accessories Vendor',
        slug: 'phone-accessories-vendor',
        sortOrder: 1,
      },
      { name: 'Appliance Repair', slug: 'appliance-repair', sortOrder: 2 },
      {
        name: 'TV & Electronics Repair',
        slug: 'tv-electronics-repair',
        sortOrder: 3,
      },
      {
        name: 'Laptop & Computer Repair',
        slug: 'laptop-computer-repair',
        sortOrder: 4,
      },
      {
        name: 'WiFi & Network Installation',
        slug: 'wifi-network-installation',
        sortOrder: 5,
      },
      {
        name: 'CCTV & Alarm Installation',
        slug: 'cctv-alarm-installation',
        sortOrder: 6,
      },
      {
        name: 'Printer & Cartridge Refill',
        slug: 'printer-cartridge-refill',
        sortOrder: 7,
      },
      { name: 'IT Support', slug: 'it-support', sortOrder: 8 },
    ],
  },
  {
    name: 'Education & Training',
    slug: 'education-and-training',
    sortOrder: 13,
    subcategories: [
      { name: 'Crèche & ECD', slug: 'creche-ecd', sortOrder: 0 },
      { name: 'Driving School', slug: 'driving-school', sortOrder: 1 },
      {
        name: 'Skills & Artisan Training',
        slug: 'skills-artisan-training',
        sortOrder: 2,
      },
      {
        name: 'Computer Literacy Classes',
        slug: 'computer-literacy-classes',
        sortOrder: 3,
      },
      { name: 'Music Lessons', slug: 'music-lessons', sortOrder: 4 },
    ],
  },
  {
    name: 'Pets & Animals',
    slug: 'pets-and-animals',
    sortOrder: 14,
    subcategories: [
      {
        name: 'Veterinary Services',
        slug: 'veterinary-services',
        sortOrder: 0,
      },
      { name: 'Pet Shop', slug: 'pet-shop', sortOrder: 1 },
      { name: 'Pet Grooming', slug: 'pet-grooming', sortOrder: 2 },
      {
        name: 'Pet Sitting & Dog Walking',
        slug: 'pet-sitting-dog-walking',
        sortOrder: 3,
      },
    ],
  },
  {
    name: 'Online Services',
    slug: 'online-services',
    sortOrder: 15,
    subcategories: [
      { name: 'Digital Products', slug: 'digital-products', sortOrder: 0 },
      {
        name: 'Social Media Management',
        slug: 'social-media-management',
        sortOrder: 1,
      },
      { name: 'Graphic Design', slug: 'graphic-design', sortOrder: 2 },
      {
        name: 'Web Design & Development',
        slug: 'web-design-development',
        sortOrder: 3,
      },
      {
        name: 'CV Writing & Career Coaching',
        slug: 'cv-writing-career-coaching',
        sortOrder: 4,
      },
      {
        name: 'Content Writing & Copywriting',
        slug: 'content-writing-copywriting',
        sortOrder: 5,
      },
      {
        name: 'Virtual Assistant & Admin Support',
        slug: 'virtual-assistant-admin-support',
        sortOrder: 6,
      },
      {
        name: 'Data Entry & Research',
        slug: 'data-entry-research',
        sortOrder: 7,
      },
    ],
  },
  {
    name: 'Other',
    slug: 'other',
    sortOrder: 16,
    subcategories: [{ name: 'General', slug: 'general', sortOrder: 0 }],
  },
];
