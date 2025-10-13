import { Router } from "express";
import AdsCost from "../models/AdsCosts.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import multer from "multer";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "uploads/" });

// helper to import XLSX safely (ESM compatible)
async function loadXLSX() {
  const mod = await import("xlsx");
  return (mod as any).default || mod;
}

// ✅ Get all AdsCost for logged-in user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = await AdsCost.find({ userId: req.userId }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ads costs", error: String(err) });
  }
});

// ✅ Add new AdsCost
router.post("/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const newCost = new AdsCost({
      ...req.body,
      userId: req.userId,
    });
    const saved = await newCost.save();
    res.status(201).json(saved);
  } catch (err) {
    console.log('err', err);
    res.status(400).json({ message: "Failed to add ads cost", error: String(err) });
  }
});

// ✅ Edit AdsCost
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updated = await AdsCost.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "AdsCost not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update ads cost", error: String(err) });
  }
});

// ✅ Delete AdsCost
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const deleted = await AdsCost.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!deleted) return res.status(404).json({ message: "AdsCost not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete ads cost", error: String(err) });
  }
});

/**
 * POST /api-v1/operating-costs/upload
 * Upload an Excel file with columns: action, date, value, usedFor, note
 */
// helper to normalize Excel date
function parseExcelDate(value: any): string {
  if (!value) return "";

  // Case 1: Already a Date object
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  // Case 2: Excel gives number (serial date)
  if (typeof value === "number") {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    return epoch.toISOString().split("T")[0];
  }

  // Case 3: String like "8/15/2025" or "2025-08-15"
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return ""; // fallback
}

router.post("/upload", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Validate + transform rows
    const validRows = rows.map((row) => ({
      userId: req.userId, // attach user
      platform: String(row.platform).trim(), // e.g. "TikTok", "Facebook", "Shopee"
      date: parseExcelDate(row.date), // YYYY-MM-DD
      spendActual: Number(row.spendActual),
      ordersDelivered: Number(row.ordersDelivered),
      ordersReturned: Number(row.ordersReturned),
      netRevenue: Number(row.netRevenue), // after returns/refunds
      platformFee: Number(row.platformFee),
      returnFee: Number(row.returnFee), // This fee incluse ship-back and broken goods
      targetProduct: String(row.targetProduct || ""),
      idProduct: String(row.idProduct || ""),
    }));

    // Insert all at once
    const inserted = await AdsCost.insertMany(validRows);

    // cleanup
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    res.json({ message: "AdsCosts uploaded successfully", count: inserted.length, inserted });
  } catch (err) {
    console.error("upload ads cost error:", err);
    res.status(500).json({ message: "Failed to upload AdsCosts", error: String(err) });
  }
});

export default router;
