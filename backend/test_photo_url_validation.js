const assert = require("assert");
const { createPickupSchema } = require("./src/validation/schemas");

console.log("Running createPickupSchema photoUrl validation tests...\n");

const baseValidPickup = {
  wasteType: "MIXED_RECYCLABLES",
  quantityBand: "MEDIUM",
  address: "123 Green Street, Pune",
  slotPeriod: "MORNING",
  requestedDate: new Date().toISOString(),
  latitude: 18.5204,
  longitude: 73.8567,
};

// 1. Valid cases
const validCases = [
  { desc: "Local upload path", photoUrl: "/uploads/pickup_1729000000_abc123.jpg" },
  { desc: "Local upload PNG", photoUrl: "/uploads/pickup_photo.png" },
  { desc: "Local upload WebP", photoUrl: "/uploads/pickup_photo.webp" },
  { desc: "Cloudinary HTTPS URL", photoUrl: "https://res.cloudinary.com/wastewise/image/upload/sample.jpg" },
  { desc: "Generic HTTPS URL", photoUrl: "https://images.unsplash.com/photo-1234.jpg" },
  { desc: "Omitted photo (optional)", photoUrl: undefined },
];

for (const { desc, photoUrl } of validCases) {
  const result = createPickupSchema.safeParse({ ...baseValidPickup, photoUrl });
  assert.strictEqual(
    result.success,
    true,
    `Expected valid for "${desc}" (${photoUrl}), but got error: ${JSON.stringify(result.error?.errors)}`
  );
  console.log(`  ✓ Accepted: ${desc} -> ${photoUrl || "(omitted)"}`);
}

// 2. Rejected invalid/dangerous cases
const rejectedCases = [
  { desc: "javascript: URI", photoUrl: "javascript:alert(1)" },
  { desc: "data: URI", photoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
  { desc: "Insecure http URL", photoUrl: "http://insecure.example.com/test.jpg" },
  { desc: "ftp protocol", photoUrl: "ftp://files.example.com/test.jpg" },
  { desc: "Path traversal in relative path", photoUrl: "/uploads/../../etc/passwd" },
  { desc: "Relative path not starting with /uploads/", photoUrl: "/images/test.jpg" },
  { desc: "javascript inside /uploads path", photoUrl: "/uploads/javascript:alert(1)" },
  { desc: "Colon in relative upload path", photoUrl: "/uploads/photo:dangerous.jpg" },
  { desc: "Arbitrary text", photoUrl: "some-random-string" },
];

for (const { desc, photoUrl } of rejectedCases) {
  const result = createPickupSchema.safeParse({ ...baseValidPickup, photoUrl });
  assert.strictEqual(
    result.success,
    false,
    `Expected rejection for "${desc}" (${photoUrl}), but it unexpectedly succeeded!`
  );
  console.log(`  ✓ Rejected: ${desc} -> ${photoUrl.slice(0, 40)}...`);
}

console.log("\nAll photoUrl validation tests passed successfully!");
