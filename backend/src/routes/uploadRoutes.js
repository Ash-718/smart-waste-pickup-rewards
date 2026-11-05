const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { uploadPickupPhoto } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/auth");
const { HttpError } = require("../middleware/errorHandler");

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
]);
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Multer diskStorage saves files directly to backend/uploads with random server-generated names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype.toLowerCase()] || ".jpg";
    const filename = `pickup_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const validExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

    // 1. Must be an allowed image MIME type
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return cb(new HttpError(400, "Only JPEG, PNG, and WebP image uploads are allowed"));
    }

    // 2. If a file extension is present in originalname, ensure it matches an allowed image extension.
    // (Note: Mobile device uploads and Web Blobs often send extensionless names like 'blob' or '1000342', which are safe because storage.filename attaches a safe server-derived extension).
    if (rawExt && !validExts.has(rawExt)) {
      return cb(new HttpError(400, "Only JPEG, PNG, and WebP image uploads are allowed"));
    }

    cb(null, true);
  },
});

// Safe wrapper to catch Multer errors and return clean JSON without crashing
const handleUpload = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large. Maximum allowed size is 10MB." });
      }
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    next();
  });
};

const router = express.Router();

router.post("/pickup-photo", requireAuth, handleUpload, uploadPickupPhoto);

module.exports = router;
