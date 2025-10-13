// routes/ping.js
import express from "express";
import Staff from "../models/Staff.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/ping", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId; // from JWT
  try {
    await Staff.updateOne(
      { userId },
      { $set: { lastSeen: new Date() } }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// get all staff with computed online/offline
router.get("/staff-status", async (req, res) => {
  try {
    const staffs = await Staff.find({});
    const now = Date.now();
    const threshold = 2 * 60 * 1000; // 2 minutes

    const results = staffs.map((s) => ({
      staffID: s.staffID,
      name: s.staffInfo?.name,
      isOnline: s.lastSeen && (now - new Date(s.lastSeen).getTime()) < threshold,
      lastSeen: s.lastSeen,
    }));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
