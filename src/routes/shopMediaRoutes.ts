// shopMediaRoutes.ts
import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware.js";
import ShopMedia from "../models/ShopMedia.js";

const router = express.Router();

// ✅ ensure upload folder exists
const uploadDir = "uploads/shopMedias";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ Multer storage
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

// ======================================
// ➕ Add new media (image or video)
// ======================================
router.post("/shop-media/add", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { shopId, type } = req.body; // type: "image" | "video"
    if (!userId || !req.file || !type) {
      return res.status(400).json({ message: "Missing file, user, or type" });
    }

    const tempPublicUrl = "http://localhost:3000"
    const fileUrl = `${tempPublicUrl}/uploads/shopMedias/${req.file.filename}`;
    const fileData = { name: req.file.originalname, url: fileUrl, id: uuidv4() };

    let shopMedia = await ShopMedia.findOne({ userId, shopId });
    if (!shopMedia) {
      shopMedia = await ShopMedia.create({
        userId,
        shopId,
        images: [],
        videos: [],
      });
    }

    if (type === "image") shopMedia.images.push(fileData);
    else if (type === "video") shopMedia.videos.push(fileData);

    await shopMedia.save();

    res.json({ status: "success", data: shopMedia });
  } catch (err) {
    console.error("❌ Upload media error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================================
// ❌ Delete Media
// ======================================
router.delete("/shop-media/:type/:fileName", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { type, fileName } = req.params;
    const userId = req.userId;
    const { shopId } = req.query;

    if (!shopId) return res.status(400).json({ message: "Missing shopId" });

    const shopMedia = await ShopMedia.findOne({ userId, shopId });
    if (!shopMedia) return res.status(404).json({ message: "No media found" });

    const listKey = type === "video" ? "videos" : "images";
    shopMedia[listKey] = shopMedia[listKey].filter((m) => !m.url.includes(fileName));

    await shopMedia.save();

    // remove local file
    const filePath = path.join(uploadDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ status: "success", data: shopMedia });
  } catch (err) {
    console.error("❌ Delete media error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================================
// 📦 Get Media
// ======================================
router.get("/shop-media", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { shopId } = req.query;
    const userId = req.userId;
    if (!shopId) return res.status(400).json({ message: "Missing shopId" });

    const shopMedia = await ShopMedia.findOne({ userId, shopId });
    res.json({ status: "success", data: shopMedia || { images: [], videos: [] } });
  } catch (err) {
    console.error("❌ Get media error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
