// Wipes ALL user-generated data (users, businesses, rooms, gigs, bookings,
// reports, verification codes, etc.) and leaves exactly one account: the
// admin. Business categories/subcategories (taxonomy, not user data) are
// left untouched since the app needs them to function.
//
// Usage:  node scripts/reset-to-admin-only.js

require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const ADMIN = {
  firstName: "Banele",
  surname: "Ngubane",
  email: "banelengubane107@gmail.com",
  password: "King@2025",
};

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "cosmopolitan",
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Truncating listing/activity/user tables...");
    await client.query(`
      TRUNCATE TABLE
        bookings,
        blocked_slots,
        business_booking_settings,
        businesses,
        room,
        gigs,
        reports,
        uploaded_image_hashes,
        verification_code,
        otp,
        auth,
        "user"
      RESTART IDENTITY CASCADE
    `);

    console.log("Creating admin user...");
    const passwordHash = await bcrypt.hash(ADMIN.password, 10);
    const res = await client.query(
      `INSERT INTO "user"
        ("firstName", surname, email, "emailVerified", "passwordHash", role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [ADMIN.firstName, ADMIN.surname, ADMIN.email, true, passwordHash, "admin"],
    );

    console.log(`Done. Admin user id ${res.rows[0].id} (${ADMIN.email}) is now the only account.`);
    console.log("Business categories/subcategories were left intact.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
