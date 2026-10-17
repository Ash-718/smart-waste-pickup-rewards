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

// Multer diskStorage saves files directly to backend/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `pickup_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new HttpError(400, "Only image uploads are allowed"));
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
