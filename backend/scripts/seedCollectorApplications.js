const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/db/client');
const bcrypt = require('bcryptjs');

async function seed() {
  const hash = await bcrypt.hash('Driver@123', 10);
  const sureshUser = await prisma.user.findUnique({
    where: { email: 'suresh.patil@wastewise.local' }
  });
  const adminUser = await prisma.user.findFirst({
    where: { role: 'admin' }
  });

  const sampleApps = [
    {
      name: "Rajesh Gaikwad",
      email: "rajesh.gaikwad@example.com",
      phone: "+919822100001",
      passwordHash: hash,
      address: "Plot 14, Near Ganpati Temple, Sangli-Miraj Road, Sangli 416416",
      licenseNumber: "MH-10-2022-0045123",
      vehicleTypePref: "Electric Mini Van",
      status: "pending",
    },
    {
      name: "Mahesh Shinde",
      email: "mahesh.shinde@example.com",
      phone: "+919822100002",
      passwordHash: hash,
      address: "Galli No. 4, Brahman Puri, Miraj 416410",
      licenseNumber: "MH-10-2020-0098432",
      vehicleTypePref: "Tata Ace Recycler",
      status: "pending",
    },
    {
      name: "Suresh Patil",
      email: "suresh.patil@wastewise.local",
      phone: "+919800000031",
      passwordHash: hash,
      address: "APMC Market Yard, Miraj 416410",
      licenseNumber: "MH-10-2018-0012984",
      vehicleTypePref: "Tata Ace Recycler",
      status: "approved",
      reviewedAt: new Date(),
      reviewedById: adminUser?.id || null,
      userId: sureshUser?.id || null,
    },
    {
      name: "Sunil Mane",
      email: "sunil.mane@example.com",
      phone: "+919822100003",
      passwordHash: hash,
      address: "MIDC Kupwad, Sangli 416436",
      licenseNumber: "MH-10-INVALID-99",
      vehicleTypePref: "Three Wheeler Loader",
      status: "rejected",
      rejectionReason: "Commercial transport permit missing; vehicle registration mismatch.",
      reviewedAt: new Date(),
      reviewedById: adminUser?.id || null,
    }
  ];

  for (const app of sampleApps) {
    const existing = await prisma.collectorApplication.findFirst({
      where: { OR: [{ email: app.email }, { phone: app.phone }] }
    });
    if (!existing) {
      await prisma.collectorApplication.create({ data: app });
      console.log(`✓ Created collector application for ${app.name} (${app.status})`);
    } else {
      console.log(`ℹ Application for ${app.name} already exists.`);
    }
  }
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

