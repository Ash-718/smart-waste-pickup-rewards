const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cloudinary = require("../config/cloudinary");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const uploadPickupPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded");

  // If Cloudinary is configured with credentials, upload to Cloudinary
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "wastewise/pickups", resource_type: "image" },
          (err, uploaded) => (err ? reject(err) : resolve(uploaded))
        );
        stream.end(req.file.buffer);
      });
      return res.status(201).json({ photoUrl: result.secure_url });
    } catch (cloudinaryErr) {
      console.warn("Cloudinary upload failed, falling back to local file storage:", cloudinaryErr.message);
    }
  }

  // Local filesystem fallback
  const uploadsDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(req.file.originalname) || ".jpg";
  const filename = `pickup_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
  const filePath = path.join(uploadsDir, filename);

  fs.writeFileSync(filePath, req.file.buffer);

  const host = req.get("host") || "localhost:4000";
  const protocol = req.protocol || "http";
  const photoUrl = `${protocol}://${host}/uploads/${filename}`;

  res.status(201).json({ photoUrl });
});

module.exports = { uploadPickupPhoto };
