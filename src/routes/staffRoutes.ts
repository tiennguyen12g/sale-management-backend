import { Router } from "express";
import Staff from "../models/Staff.js";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { DailyRecordType } from "../models/Staff.js";
const router = Router();
const upload = multer({ dest: "uploads/excels/" });
// Create staff
router.post("/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const staff = new Staff({
      ...req.body,
      userId: req.userId, // 🔑 link to user
    });
    const saved = await staff.save();
    res.status(201).json(saved);
  } catch (err) {
    console.log("err", err);
    res.status(400).json({ message: "Failed to add staff", error: String(err) });
  }
});

// Get all staff
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const staffRole = req.user?.staffRole;
    let query: any = {};

    if (staffRole !== "admin") {
      query = { userId: req.userId };
    }
    const staffs = await Staff.find(query);
    res.json(staffs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff", error: String(err) });
  }
});

// Get your staff profile
router.get("/:staffID/:userId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const staffRole = req.user?.staffRole;
    const {staffID, userId }= req.params;

    if(!staffID || !userId) return  res.status(500).json({ message: `Failed to fetch staff id: ${staffID}` });
    const staff = await Staff.findOne({staffID, userId});
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff", error: String(err) });
  }
});

router.put("/:staffID", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updated = await Staff.findOneAndUpdate(
      { staffID: req.params.staffID, userId: req.userId }, // 🔑 check ownership
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Staff not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update staff", error: String(err) });
  }
});

// ✅ Delete staff (only if belongs to user)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const deleted = await Staff.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete staff", error: String(err) });
  }
});

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
router.post("/upload-salary", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
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

        // ✅ Remove old month entry if exists
        await Staff.updateOne({ staffID }, { $pull: { salaryHistory: { time } } });

        // ✅ Push new month entry
        await Staff.updateOne({ staffID }, { $push: { salaryHistory: record } });

        recordsForStaff.push(record);
      }

      // fetch updated doc to check if matched
      const result = await Staff.findOne({ staffID });

      updates.push({ staffID, records: recordsForStaff, matched: !!result });
    }

    // cleanup uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      /* ignore */
    }

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
// router.post("/upload-attendance", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded" });

//     const XLSX = await loadXLSX();
//     const buf = fs.readFileSync(req.file.path);
//     const workbook = XLSX.read(buf, { type: "buffer" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

//     const updates: { staffID: string; records: any[]; matched: boolean }[] = [];

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

//     for (const row of rows) {
//       const staffID = row["ID"] ?? row["Staff ID"] ?? row["Id"] ?? row["id"];
//       if (!staffID) continue;

//       const attendanceRecords: any[] = [];

//       for (const [col, val] of Object.entries(row)) {
//         if (dateRegex.test(col) && val) {
//           const checked = String(val).trim();
//           if (["onTime", "late", "absent"].includes(checked)) {
//             attendanceRecords.push({ date: col, checked });
//           } else {
//             // if you need to map other representations, do it here
//             attendanceRecords.push({ date: col, checked });
//           }
//         }
//       }

//       if (attendanceRecords.length === 0) {
//         updates.push({ staffID, records: [], matched: false });
//         continue;
//       }

//       for (const att of attendanceRecords) {
//         await Staff.updateOne({ staffID }, { $pull: { attendance: { date: att.date } } });
//         await Staff.updateOne({ staffID }, { $push: { attendance: att } });
//       }

//       const result = await Staff.findOne({ staffID });

//       updates.push({ staffID, records: attendanceRecords, matched: !!result });
//     }

//     // cleanup uploaded file
//     try {
//       fs.unlinkSync(req.file.path);
//     } catch (e) {
//       /* ignore */
//     }

//     res.json({ message: "Attendance upload processed", updates });
//   } catch (err) {
//     console.error("upload-attendance error:", err);
//     res.status(500).json({ message: "Failed to upload attendance", error: String(err) });
//   }
// });

// POST /upload-daily-records
// router.post("/upload-daily-records", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded" });

//     const XLSX = await loadXLSX();
//     const buf = fs.readFileSync(req.file.path);
//     const workbook = XLSX.read(buf, { type: "buffer" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

//     const updates: { staffID: string; records: DailyRecordType[]; matched: boolean }[] = [];

//     for (const row of rows) {
//       const staffID = row["Staff ID"] ?? row["ID"] ?? row["Id"] ?? row["id"];
//       if (!staffID) continue;

//       const record: DailyRecordType = {
//         date: String(row["Date"]).slice(0, 10), // keep "YYYY-MM-DD"
//         bonus: Number(row["Bonus"] ?? 0),
//         bonusNote: row["Bonus Note"] ?? "",
//         fine: Number(row["Fine"] ?? 0),
//         fineNote: row["Fine Note"] ?? "",
//         overtime: Number(row["Overtime"] ?? 0),
//         overtimeNote: row["Overtime Note"] ?? "",
//       };

//       if (!record.date) continue; // skip if no date

//       // ✅ Remove existing record with same date (avoid duplicates per staff/date)
//       await Staff.updateOne({ staffID }, { $pull: { dailyRecords: { date: record.date } } });

//       //         await Staff.updateOne(
//       //   { staffID },
//       //   { $push: { dailyRecords: newRecord } } // push new one
//       // );

//       // ✅ Push new record
//       await Staff.updateOne({ staffID }, { $push: { dailyRecords: record } });

//       // fetch updated doc to confirm
//       const result = await Staff.findOne({ staffID }, { staffID: 1, dailyRecords: 1 });

//       updates.push({
//         staffID,
//         records: [record],
//         matched: !!result,
//       });
//     }

//     // cleanup uploaded file
//     try {
//       fs.unlinkSync(req.file.path);
//     } catch (e) {
//       /* ignore */
//     }

//     res.json({ message: "Daily records upload processed", updates });
//   } catch (err) {
//     console.error("upload-daily-records error:", err);
//     res.status(500).json({ message: "Failed to upload daily records", error: String(err) });
//   }
// });
router.post("/upload-daily-records", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const updates: {
      staffID: string;
      records: DailyRecordType[];
      matched: boolean;
    }[] = [];

    // helper: default salary history structure
    function defaultSalaryHistory(time: string) {
      return {
        time,
        baseSalary: 0,
        totalCloseOrder: 0,
        totalDistributionOrder: 0,
        totalRevenue: 0,
        isPaid: false,
        fine: { note: "", value: 0 },
        bonus: { note: "", value: 0 },
        overtime: { totalTime: 0, value: 0, note: "" },
        attendance: [],
        dailyRecords: [],
      };
    }

    for (const row of rows) {
      const staffID = row["Staff ID"] ?? row["ID"] ?? row["Id"] ?? row["id"];
      if (!staffID) continue;

      const dateStr = String(row["Date"]).slice(0, 10); // "YYYY-MM-DD"
      if (!dateStr) continue;

      const monthKey = dateStr.slice(0, 7); // "YYYY-MM"

      const record: DailyRecordType = {
        date: dateStr,
        bonus: Number(row["Bonus"] ?? 0),
        bonusNote: row["Bonus Note"] ?? "",
        fine: Number(row["Fine"] ?? 0),
        fineNote: row["Fine Note"] ?? "",
        overtime: Number(row["Overtime"] ?? 0),
        overtimeNote: row["Overtime Note"] ?? "",
      };

      // Step 1: ensure salaryHistory for that month exists
      const staff = await Staff.findOne({ staffID });
      if (!staff) continue;

      let history = staff.salaryHistory.find((h) => h.time === monthKey);

      if (!history) {
        await Staff.updateOne({ staffID }, { $push: { salaryHistory: defaultSalaryHistory(monthKey) } });
      }

      // Step 2: remove existing record with same date (avoid duplicate per day)
      await Staff.updateOne({ staffID, "salaryHistory.time": monthKey }, { $pull: { "salaryHistory.$.dailyRecords": { date: record.date } } });

      // Step 3: push new record
      await Staff.updateOne({ staffID, "salaryHistory.time": monthKey }, { $push: { "salaryHistory.$.dailyRecords": record } });

      updates.push({
        staffID,
        records: [record],
        matched: true,
      });
    }

    // cleanup uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      /* ignore */
    }

    res.json({ message: "Daily records upload processed", updates });
  } catch (err) {
    console.error("upload-daily-records error:", err);
    res.status(500).json({
      message: "Failed to upload daily records",
      error: String(err),
    });
  }
});

router.post("/upload-attendance", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const updates: { staffID: string; records: any[]; matched: boolean }[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // helper: default salary history structure
    function defaultSalaryHistory(time: string) {
      return {
        time,
        baseSalary: 0,
        totalCloseOrder: 0,
        totalDistributionOrder: 0,
        totalRevenue: 0,
        isPaid: false,
        fine: { note: "", value: 0 },
        bonus: { note: "", value: 0 },
        overtime: { totalTime: 0, value: 0, note: "" },
        attendance: [],
        dailyRecords: [],
      };
    }

    for (const row of rows) {
      const staffID = row["ID"] ?? row["Staff ID"] ?? row["Id"] ?? row["id"];
      if (!staffID) continue;

      const attendanceRecords: any[] = [];

      // loop all columns → find valid dates
      for (const [col, val] of Object.entries(row)) {
        if (dateRegex.test(col) && val) {
          const checked = String(val).trim();
          if (["onTime", "late", "absent"].includes(checked)) {
            attendanceRecords.push({ date: col, checked });
          } else {
            // keep raw if not normalized
            attendanceRecords.push({ date: col, checked });
          }
        }
      }

      if (attendanceRecords.length === 0) {
        updates.push({ staffID, records: [], matched: false });
        continue;
      }

      const staff = await Staff.findOne({ staffID });
      if (!staff) continue;

      for (const att of attendanceRecords) {
        const monthKey = att.date.slice(0, 7); // "YYYY-MM"

        let history = staff.salaryHistory.find((h) => h.time === monthKey);
        if (!history) {
          await Staff.updateOne({ staffID }, { $push: { salaryHistory: defaultSalaryHistory(monthKey) } });
        }

        // remove old attendance for that date
        await Staff.updateOne({ staffID, "salaryHistory.time": monthKey }, { $pull: { "salaryHistory.$.attendance": { date: att.date } } });

        // push new attendance
        await Staff.updateOne({ staffID, "salaryHistory.time": monthKey }, { $push: { "salaryHistory.$.attendance": att } });
      }

      updates.push({ staffID, records: attendanceRecords, matched: true });
    }

    // cleanup uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      /* ignore */
    }

    res.json({ message: "Attendance upload processed", updates });
  } catch (err) {
    console.error("upload-attendance error:", err);
    res.status(500).json({
      message: "Failed to upload attendance",
      error: String(err),
    });
  }
});

// POST /update-salary
// body: { staffID?: string, time: string, workDays: number, workHoursPerDay: number }

// POST /update-salary
// body: { time: string, workDays: number, workHoursPerDay: number }

// router.post("/update-salary", authMiddleware, async (req: AuthRequest, res) => {
//   try {
//     const { time, workDays = 26, workHoursPerDay = 8 } = req.body;
//     if (!time) return res.status(400).json({ message: "Missing time (YYYY-MM)" });

//     // find all staff
//     const staffs = await Staff.find({});
//     if (!staffs || staffs.length === 0) {
//       return res.status(404).json({ message: "No staff found" });
//     }

//     const updates: any[] = [];

//     for (const staff of staffs) {
//       // find salaryHistory entry for this month
//       let history = staff.salaryHistory.find((h: any) => h.time === time);

//       // if not exist, create default history for that month
//       if (!history) {
//         history = {
//           time,
//           baseSalary: staff.salary || 0,
//           totalCloseOrder: 0,
//           totalDistributionOrder: 0,
//           totalRevenue: 0,
//           isPaid: false,
//           fine: { note: "", value: 0 },
//           bonus: { note: "", value: 0 },
//           overtime: { totalTime: 0, value: 0, note: "" },
//           attendance: [],
//           dailyRecords: [],
//         };
//         staff.salaryHistory.push(history);
//       }

//       // calculate totals from dailyRecords
//       const totalBonus = (history.dailyRecords || []).reduce(
//         (sum: number, r: any) => sum + (Number(r.bonus) || 0),
//         0
//       );
//       const totalFine = (history.dailyRecords || []).reduce(
//         (sum: number, r: any) => sum + (Number(r.fine) || 0),
//         0
//       );
//       const totalOvertimeHours = (history.dailyRecords || []).reduce(
//         (sum: number, r: any) => sum + (Number(r.overtime) || 0),
//         0
//       );

//       // overtime salary
//       const salaryPerHour = (staff.salary || 0) / (workDays * workHoursPerDay);
//       const overtimeValue = salaryPerHour * totalOvertimeHours;

//       // update history values
//       history.bonus.value = totalBonus;
//       history.fine.value = totalFine;
//       history.overtime.totalTime = totalOvertimeHours;
//       history.overtime.value = overtimeValue;

//       await staff.save();

//       console.log('gdf', staff.salary);
//       updates.push({
//         staffID: staff.staffID,
//         name: staff.staffInfo?.name,
//         time,
//         baseSalary: staff.salary,
//         bonus: history.bonus,
//         fine: history.fine,
//         overtime: history.overtime,
//       });
//     }

//     res.json({ message: "Salary updated for all staff", updates });
//   } catch (err) {
//     console.error("update-salary error:", err);
//     res.status(500).json({ message: "Failed to update salary", error: String(err) });
//   }
// });

// routes/salary.ts
router.post("/update-salary", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { time, workDays = 26, workHoursPerDay = 8, overTimeRate = 100 } = req.body;
    if (!time) {
      return res.status(400).json({ message: "Missing time (YYYY-MM)" });
    }

    const staffList = await Staff.find({});
    const updates: any[] = [];

    for (const staff of staffList) {
      const salaryPerHour = staff.salary ? staff.salary / (workDays * workHoursPerDay) : 0;

      // find salary history for this month
      let history = staff.salaryHistory.find((h: any) => h.time === time);

      // if not exists, push default
      if (!history) {
        const defaultHistory = {
          time,
          baseSalary: staff.salary || 0,
          totalCloseOrder: 0,
          totalDistributionOrder: 0,
          totalRevenue: 0,
          isPaid: false,
          fine: { note: "", value: 0 },
          bonus: { note: "", value: 0 },
          overtime: { totalTime: 0, value: 0, note: "" },
          attendance: [],
          dailyRecords: [],
        };
        await Staff.updateOne({ staffID: staff.staffID }, { $push: { salaryHistory: defaultHistory } });
        history = defaultHistory;
      }

      // --- aggregate from dailyRecords ---
      const dailyRecords = history.dailyRecords || [];

      const totalBonus = dailyRecords.reduce((sum: number, r: any) => sum + (r.bonus || 0), 0);
      const totalFine = dailyRecords.reduce((sum: number, r: any) => sum + (r.fine || 0), 0);

      const totalOvertimeHours = dailyRecords.reduce((sum: number, r: any) => sum + (r.overtime || 0), 0);
      const overtimeValue = salaryPerHour * totalOvertimeHours * (overTimeRate / 100);
      const overtimeValueFIx = overtimeValue.toFixed(1);

      // --- update this month record ---
      await Staff.updateOne(
        { staffID: staff.staffID, "salaryHistory.time": time },
        {
          $set: {
            "salaryHistory.$.baseSalary": staff.salary, // ✅ sync root salary
            "salaryHistory.$.bonus": { note: "", value: totalBonus },
            "salaryHistory.$.fine": { note: "", value: totalFine },
            "salaryHistory.$.overtime": {
              totalTime: totalOvertimeHours,
              value: overtimeValue,
              note: "",
            },
          },
        }
      );

      updates.push({
        staffID: staff.staffID,
        name: staff.staffInfo?.name,
        time,
        baseSalary: staff.salary,
        bonus: totalBonus,
        fine: totalFine,
        overtime: {
          totalTime: totalOvertimeHours,
          value: Math.round(overtimeValue * 100) / 100, // keep 2 decimals as number
        },
      });
    }

    res.json({ message: "Salary updated", updates });
  } catch (err) {
    console.error("update-salary error:", err);
    res.status(500).json({ message: "Failed to update salary", error: String(err) });
  }
});

function formatDateLocal(dateStr: string, tzOffsetMinutes = 420) {
  const d = new Date(dateStr);
  // shift milliseconds by local timezone (default: +7h = 420 min)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() + tzOffsetMinutes);
  return d.toISOString().split("T")[0];
}

export default router;
