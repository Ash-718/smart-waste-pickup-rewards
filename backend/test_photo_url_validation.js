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

// 1. Valid cases (relative /uploads/<filename> and default allowlist res.cloudinary.com)
const validCases = [
  { desc: "Local upload path JPG", photoUrl: "/uploads/pickup_1729000000_abc123.jpg" },
  { desc: "Local upload PNG", photoUrl: "/uploads/pickup_photo-123.png" },
  { desc: "Local upload WebP", photoUrl: "/uploads/pickup_photo_final.webp" },
  { desc: "Cloudinary HTTPS URL (default allowlist)", photoUrl: "https://res.cloudinary.com/wastewise/image/upload/sample.jpg" },
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
  { desc: "Non-allowlisted HTTPS host (evil.com)", photoUrl: "https://evil.com/sample.jpg" },
  { desc: "Non-allowlisted HTTPS host (unsplash)", photoUrl: "https://images.unsplash.com/photo-1234.jpg" },
  { desc: "Insecure http Cloudinary URL", photoUrl: "http://res.cloudinary.com/sample.jpg" },
  { desc: "javascript: URI", photoUrl: "javascript:alert(1)" },
  { desc: "data: URI", photoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
  { desc: "ftp protocol", photoUrl: "ftp://res.cloudinary.com/test.jpg" },
  { desc: "Plain path traversal (..)", photoUrl: "/uploads/../../etc/passwd" },
  { desc: "Encoded traversal (%2e%2e)", photoUrl: "/uploads/%2e%2e/etc/passwd" },
  { desc: "Encoded slash (%2f)", photoUrl: "/uploads/%2fetc/passwd" },
  { desc: "Mixed encoded traversal (%2e%2e%2f)", photoUrl: "/uploads/%2e%2e%2fetc/passwd" },
  { desc: "Encoded traversal in HTTPS URL", photoUrl: "https://res.cloudinary.com/%2e%2e/evil.jpg" },
  { desc: "Subdirectory in uploads path", photoUrl: "/uploads/nested/pic.jpg" },
  { desc: "Disallowed extension (.exe)", photoUrl: "/uploads/pickup_photo.exe" },
  { desc: "Relative path not starting with /uploads/", photoUrl: "/images/test.jpg" },
  { desc: "Arbitrary string", photoUrl: "random-test-string" },
];

for (const { desc, photoUrl } of rejectedCases) {
  const result = createPickupSchema.safeParse({ ...baseValidPickup, photoUrl });
  assert.strictEqual(
    result.success,
    false,
    `Expected rejection for "${desc}" (${photoUrl}), but it unexpectedly succeeded!`
  );
  console.log(`  ✓ Rejected: ${desc} -> ${photoUrl.slice(0, 45)}...`);
}

// 3. Test dynamic allowlist via PHOTO_ALLOWED_HOSTS env var
process.env.PHOTO_ALLOWED_HOSTS = "res.cloudinary.com,cdn.pruthvi.ngo";
const customHostRes = createPickupSchema.safeParse({
  ...baseValidPickup,
  photoUrl: "https://cdn.pruthvi.ngo/photos/pickup1.jpg",
});
assert.strictEqual(customHostRes.success, true, "Expected custom host in PHOTO_ALLOWED_HOSTS to be accepted");
console.log("  ✓ Accepted: Custom host in PHOTO_ALLOWED_HOSTS -> https://cdn.pruthvi.ngo/photos/pickup1.jpg");

delete process.env.PHOTO_ALLOWED_HOSTS;

console.log("\nAll photoUrl validation tests passed successfully!");
