// routes/updateDataOrderForStaff.js
import { Request, Response, Router } from "express";
import Staff from "../models/Staff.js";
import ShopOrder from "../models/ShopOrder.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/update-order-for-staffs", authMiddleware, async (req, res) => {
  try {
    const { time } = req.body; // e.g. "2025-09"
    if (!time) return res.status(400).json({ message: "Missing time" });

    // 1) Aggregate order counts per staff for this month (final.time starts with "YYYY-MM")
    const matchRegex = new RegExp(`^${time}`); // e.g. /^2025-09/
    const aggs = await ShopOrder.aggregate([
      { $match: { "final.time": { $regex: matchRegex } } },

      // wrong here
      {
        $group: {
          _id: "$staffID",
          totalDistributionOrder: { $sum: 1 },
          totalCloseOrder: {
            $sum: { $cond: [{ $eq: ["$final.status", "Chốt"] }, 1, 0] },
          },
          totalDeliverySuccess: {
            $sum: { $cond: [{ $eq: ["$final.deliveryStatus", "Giao thành công"] }, 1, 0] },
          },
          totalDeliveryReturned: {
            $sum: { $cond: [{ $eq: ["$final.deliveryStatus", "Giao thất bại"] }, 1, 0] },
          },
        },
      },
    ]);
    // console.log('aggs', aggs);

    // Make a lookup map: staffID -> aggregated counts
    const aggMap = new Map();
    aggs.forEach((a) => {
      aggMap.set(a._id, {
        totalDistributionOrder: a.totalDistributionOrder || 0,
        totalCloseOrder: a.totalCloseOrder || 0,
        totalDeliverySuccess: a.totalDeliverySuccess || 0,
        totalDeliveryReturned: a.totalDeliveryReturned || 0,
      });
    });

    // 2) Load all staffs to ensure we update everyone (zero counts if none)
    const staffs = await Staff.find({});

    const updates = [];

    for (const staff of staffs) {
      const staffID = staff.staffID;
      const counts = aggMap.get(staffID) || {
        totalDistributionOrder: 0,
        totalCloseOrder: 0,
        totalDeliverySuccess: 0,
        totalDeliveryReturned: 0,
      };

const updateResult = await Staff.updateOne(
  { staffID, "salaryHistory.time": time },
  {
    $set: {
      "salaryHistory.$.totalDistributionOrder": counts.totalDistributionOrder,
      "salaryHistory.$.totalCloseOrder": counts.totalCloseOrder,
      "salaryHistory.$.totalDeliverySuccess": counts.totalDeliverySuccess,
      "salaryHistory.$.totalDeliveryReturned": counts.totalDeliveryReturned,
    },
  }
);

const matched = updateResult.matchedCount > 0;
if (!matched) {
  // Push a new entry
  const entry = {
    time,
    baseSalary: typeof staff.salary === "number" ? staff.salary : 0,
    totalCloseOrder: counts.totalCloseOrder,
    totalDistributionOrder: counts.totalDistributionOrder,
    totalRevenue: 0,
    fine: { note: "", value: 0 },
    bonus: { note: "", value: 0 },
    overtime: { totalTime: 0, value: 0, note: "" },
    totalDeliverySuccess: counts.totalDeliverySuccess,
    totalDeliveryReturned: counts.totalDeliveryReturned,
  };

  await Staff.updateOne(
    { staffID },
    { $push: { salaryHistory: entry } },
    { upsert: false }
  );
  updates.push({ staffID, created: true, ...counts });
} else {
  updates.push({ staffID, updated: true, ...counts });
}

    }

    return res.json({ updates });
  } catch (err: any) {
    console.error("update-order-for-staffs error:", err);
    return res.status(500).json({ message: err.message || String(err) });
  }
});

export default router;
