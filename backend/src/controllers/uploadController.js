const cloudinary = require("../config/cloudinary");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const uploadPickupPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded");

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "wastewise/pickups", resource_type: "image" },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(req.file.buffer);
  });

  res.status(201).json({ photoUrl: result.secure_url });
});

module.exports = { uploadPickupPhoto };
