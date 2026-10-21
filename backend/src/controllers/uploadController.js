const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const uploadPickupPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded");

  // Check if Cloudinary is configured with valid credentials
  const hasCloudinary =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (hasCloudinary) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "wastewise/pickups",
        resource_type: "image",
      });
      // Delete temporary local file on disk if Cloudinary succeeded
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(201).json({ photoUrl: result.secure_url });
    } catch (cloudinaryErr) {
      console.warn("[Upload] Cloudinary upload failed, falling back to local file storage:", cloudinaryErr.message);
    }
  }

  // Local filesystem fallback: return relative path starting with /uploads/
  // The client will prepend its own reachable base URL
  const photoUrl = `/uploads/${req.file.filename}`;
  res.status(201).json({ photoUrl });
});

module.exports = { uploadPickupPhoto };
