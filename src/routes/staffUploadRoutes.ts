// src/routes/staffUploadRoutes.ts
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import Staff from "../models/Staff.js"; // adjust path if needed

const router = Router();
const upload = multer({ dest: "uploads/" });

async function loadXLSX() {
  const mod = await import("xlsx");
  // Some builds expose everything at top-level, some under default
  return (mod as any).default ?? mod;
}

/**
 * POST /api-v1/staff/upload-salary
 * Expects form-data file field name: "file"
 * Salary file columns example: ID, Name, 2025-07_baseSalary, 2025-07_bonus, 2025-07_fine, 2025-07_totalRevenue, 2025-07_totalCloseOrder, 2025-07_totalDistributionOrder, ...
 */
router.post("/upload-salary", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const updates: { staffID: string; records: any[]; matched: boolean }[] = [];

    for (const row of rows) {
      const staffID = row["ID"] ?? row["Id"] ?? row["id"];
      if (!staffID) continue;

      // find all month keys by looking for keys ending with '_baseSalary'
      const baseKeys = Object.keys(row).filter((k) => k.endsWith("_baseSalary"));

      const recordsForStaff: any[] = [];

      for (const baseKey of baseKeys) {
        const time = baseKey.replace("_baseSalary", ""); // e.g. "2025-07"
        const record: any = {
          time,
          baseSalary: Number(row[`${time}_baseSalary`] ?? 0),
          totalCloseOrder: Number(row[`${time}_totalCloseOrder`] ?? 0),
          totalDistributionOrder: Number(row[`${time}_totalDistributionOrder`] ?? 0),
          totalRevenue: Number(row[`${time}_totalRevenue`] ?? 0),
        };

        const bonusVal = row[`${time}_bonus`];
        if (bonusVal !== null && bonusVal !== undefined && bonusVal !== "") {
          record.bonus = { note: "", value: Number(bonusVal) };
        }
        const fineVal = row[`${time}_fine`];
        if (fineVal !== null && fineVal !== undefined && fineVal !== "") {
          record.fine = { note: "", value: Number(fineVal) };
        }

        recordsForStaff.push(record);
      }

      if (recordsForStaff.length === 0) {
        updates.push({ staffID, records: [], matched: false });
        continue;
      }

      // push all records in one DB operation using $each
      const result = await Staff.findOneAndUpdate(
        { staffID },
        { $push: { salaryHistory: { $each: recordsForStaff } } },
        { new: true }
      );

      updates.push({ staffID, records: recordsForStaff, matched: !!result });
    }

    // cleanup uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

    res.json({ message: "Salary upload processed", updates });
  } catch (err) {
    console.error("upload-salary error:", err);
    res.status(500).json({ message: "Failed to upload salary", error: String(err) });
  }
});

/**
 * POST /api-v1/staff/upload-attendance
 * Expects form-data file field name: "file"
 * Attendance file columns example: ID, Name, 2025-07-01, 2025-07-02, ... values like "onTime"/"late"/"absent"
 */
router.post("/upload-attendance", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const updates: { staffID: string; records: any[]; matched: boolean }[] = [];

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const row of rows) {
      const staffID = row["ID"] ?? row["Id"] ?? row["id"];
      if (!staffID) continue;

      const attendanceRecords: any[] = [];

      for (const [col, val] of Object.entries(row)) {
        if (dateRegex.test(col) && val) {
          const checked = String(val).trim();
          if (["onTime", "late", "absent"].includes(checked)) {
            attendanceRecords.push({ date: col, checked });
          } else {
            // if you need to map other representations, do it here
            attendanceRecords.push({ date: col, checked });
          }
        }
      }

      if (attendanceRecords.length === 0) {
        updates.push({ staffID, records: [], matched: false });
        continue;
      }

      const result = await Staff.findOneAndUpdate(
        { staffID },
        { $push: { attendance: { $each: attendanceRecords } } },
        { new: true }
      );

      updates.push({ staffID, records: attendanceRecords, matched: !!result });
    }

    // cleanup uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

    res.json({ message: "Attendance upload processed", updates });
  } catch (err) {
    console.error("upload-attendance error:", err);
    res.status(500).json({ message: "Failed to upload attendance", error: String(err) });
  }
});

export default router;
