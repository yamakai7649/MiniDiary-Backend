const express = require("express");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Mini-Diary-images",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const imageUrl = req.file.path;
    const publicId = req.file.filename;

    return res.json({ imageUrl, public_id: publicId });
  } catch (err) {
    return next(err);
  }
});

router.delete("/delete", async (req, res, next) => {
  try {
    const { public_id } = req.query;

    if (!public_id) {
      return res.status(400).json({ error: "public_idが必要です" });
    }

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === "ok") {
      return res.status(200).json({ message: "画像削除に成功しました" });
    }

    return res.status(500).json({
      error: "画像削除に失敗しました",
      details: result,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
