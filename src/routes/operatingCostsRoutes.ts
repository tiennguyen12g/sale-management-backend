import { Router } from "express";
import OperatingCost from "../models/OperatingCost.js";
import multer from "multer";
import fs from "fs";

import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
const router = Router();
const upload = multer({ dest: "uploads/" });

// helper to import XLSX safely (ESM compatible)
async function loadXLSX() {
  const mod = await import("xlsx");
  return (mod as any).default || mod;
}

// ✅ Get all costs for logged-in user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = await OperatingCost.find({ userId: req.userId }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch operating costs", error: String(err) });
  }
});

// ✅ Add new cost (tie to logged-in user)
router.post("/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const newCost = new OperatingCost({
      ...req.body,
      userId: req.userId, // attach user
    });
    const saved = await newCost.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: "Failed to add cost", error: String(err) });
  }
});

// ✅ Edit (only if belongs to user)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updated = await OperatingCost.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, // check ownership
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Cost not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update cost", error: String(err) });
  }
});

// ✅ Delete (only if belongs to user)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const deleted = await OperatingCost.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!deleted) return res.status(404).json({ message: "Cost not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete cost", error: String(err) });
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
      action: String(row.action).trim(),
      date: parseExcelDate(row.date), // ✅ fixed
      value: Number(row.value),
      usedFor: String(row.usedFor || ""),
      note: String(row.note || ""),
    }));

    // Insert all at once
    const inserted = await OperatingCost.insertMany(validRows);

    // cleanup
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    res.json({ message: "Operating costs uploaded successfully", count: inserted.length, inserted });
  } catch (err) {
    console.error("upload-operating-costs error:", err);
    res.status(500).json({ message: "Failed to upload operating costs", error: String(err) });
  }
});

export default router;
