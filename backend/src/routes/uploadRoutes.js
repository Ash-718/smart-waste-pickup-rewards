const express = require("express");
const multer = require("multer");
const { uploadPickupPhoto } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post("/pickup-photo", requireAuth, upload.single("photo"), uploadPickupPhoto);

module.exports = router;
