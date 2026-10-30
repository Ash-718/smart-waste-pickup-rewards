const prisma = require("../src/db/client");

async function initTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collector_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      license_number VARCHAR(100),
      vehicle_type_pref VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending' NOT NULL,
      rejection_reason TEXT,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      reviewed_by_id UUID,
      user_id UUID UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);
  console.log("✓ collector_applications table initialized successfully in PostgreSQL!");
}

initTable()
  .catch((err) => {
    console.error("Failed to initialize table:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
