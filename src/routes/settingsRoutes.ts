import express from "express";
import fetch from "node-fetch";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware.js";
import { exapmleTagList } from "../models/Settings.js";
const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/userMedias",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

// ✅ Ensure settings exists per user
async function ensureSettings(userId: string) {
  let settings = await Settings.findOne({ userId });
  if (!settings) {
    const newSetting = {
      userId, // 🔑 tie to User
      shopTagList: [...exapmleTagList],
      fastMessages: [],
      favoritAlbum: [],
    };
    settings = await Settings.create(newSetting);
  }
  return settings;
}

/* -------------------- TAG CRUD -------------------- */

// ➕ Add Tag
router.post("/tags", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { newArrayTag} = req.body;

  const settings = await ensureSettings(userId);
  settings.shopTagList.push(...newArrayTag);
  await settings.save();

  res.json(settings.shopTagList);
});

// ✏️ Update Tag
router.put("/tags/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { id } = req.params;
  const update = req.body;

  const settings = await ensureSettings(userId);
  settings.shopTagList = settings.shopTagList.map((t) => (t.id === id ? { ...t, ...update } : t));
  await settings.save();

  res.json(settings.shopTagList);
});

// ❌ Delete Tag
router.delete("/tags/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { id } = req.params;

  const settings = await ensureSettings(userId);
  settings.shopTagList = settings.shopTagList.filter((t) => t.id !== id);
  await settings.save();

  res.json(settings.shopTagList);
});

/* ---------------- FAST MESSAGE CRUD ---------------- */

// Add Fast Message
router.post("/fast-messages", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { fastMessage } = req.body;

  const settings = await ensureSettings(userId);
  settings.fastMessages.push(fastMessage);
  await settings.save();

  res.json(settings.fastMessages);
});

// Update Fast Message
router.put("/fast-messages/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { id } = req.params;
  const update = req.body;

  const settings = await ensureSettings(userId);
  settings.fastMessages = settings.fastMessages.map((m) => (m.id === id ? { ...m, ...update } : m));
  await settings.save();

  res.json(settings.fastMessages);
});

// Delete Fast Msg
router.delete("/fast-messages/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { id } = req.params;

  const settings = await ensureSettings(userId);
  settings.fastMessages = settings.fastMessages.filter((f) => f.id !== id);
  await settings.save();

  res.json(settings.fastMessages);
});

/* ---------------- FAVORITE ALBUM CRUD ---------------- */

// Upload media & add as album item
router.post("/favorite-album", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  if (!req.file) return res.status(400).json({ message: "No file" });

  const url = `${process.env.SERVER_PUBLIC_URL}/uploads/userMedias/${req.file.filename}`;
  const item = {
    id: uuidv4(),
    nameImage: req.file.originalname,
    url,
  };

  const settings = await ensureSettings(userId);
  settings.favoritAlbum.push(item);
  await settings.save();

  res.json(settings.favoritAlbum);
});

// Remove from album
router.delete("/favorite-album/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(404).json({ message: "Unauthorized" });
  const { id } = req.params;

  const settings = await ensureSettings(userId);
  settings.favoritAlbum = settings.favoritAlbum.filter((img) => img.id !== id);
  await settings.save();

  res.json(settings.favoritAlbum);
});

export default router;
