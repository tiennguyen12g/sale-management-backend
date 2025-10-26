import { Router } from "express";
import ShopOrder from "../models/ShopOrder.js";
import NewOrder from "../models/NewOrder.js";
import Staff from "../models/Staff.js";
import { IShopOrder } from "../models/NewOrder.js";
import type { OriginalOrder, FinalOrder } from "../models/ShopOrder.js";
import Counter from "../models/Counter.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import RedistributionLock from "../models/RedistributionLock.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
const router = Router();

router.post("/new-order", async (req, res) => {
  try {
    const createOriginal: OriginalOrder = {
      time: req.body.time,
      customerName: req.body.customerName,
      phone: req.body.phone,
      address: req.body.address,
      orderInfo: req.body.orderInfo,
      total: req.body.total,
      totalProduct: req.body.totalProduct,
      totalWeight: req.body.totalWeight,
      note: req.body.note,
      staff: "Landing web",
      buyerIP: req.body.buyerIP,
      website: req.body.website,
      facebookLink: req.body.facebookLink,
      tiktokLink: req.body.tiktokLink,
    };

    const prefix = req.body.productId; // you could also send from frontend
    const seqNum = await getNextSequence(prefix);

    // Pad number with 6 digits (000001, 000002, ...)
    const padded = seqNum.toString().padStart(6, "0");
    const orderCode = `${prefix}-${padded}`;

    const createFinal: FinalOrder = {
      orderCode: orderCode,
      time: req.body.time,
      customerName: req.body.customerName,
      phone: req.body.phone,
      address: req.body.address,
      orderInfo: req.body.orderInfo,
      total: req.body.total,
      totalProduct: req.body.totalProduct,
      totalWeight: req.body.totalWeight,
      note: req.body.note,
      status: req.body.status,
      confirmed: false,
      staff: "",
      buyerIP: req.body.buyerIP,
      website: req.body.website,
      deliveryStatus: req.body.deliveryStatus,
      deliveryCode: req.body.deliveryCode,
      facebookLink: req.body.facebookLink,
      tiktokLink: req.body.tiktokLink,
      promotions: req.body.promotions,
    };
    const order = {
      productId: req.body.productId,
      staffID: "",
      orderCode: orderCode,
      original: createOriginal,
      final: createFinal,
      deliveryDetails: {
        shippedTime: "",
      },
      stockAdjusted: false,
    };
    const result = await assignOrder(order);
    res.json(result);
  } catch (err) {
    // console.log('err', err);
    res.status(400).json({ message: "Failed to add order", error: String(err) });
  }
});

let io: any; // will be set from worker

export function setSocketIO(instance: any) {
  io = instance;
}

export async function assignOrder(orderData: any) {
  const onlineStaffs = await Staff.find({ isOnline: true, role: "Sale-Staff" });
  console.log("online", onlineStaffs.length);
  if (onlineStaffs.length === 0) {
    try {
      await NewOrder.create(orderData);
      return { assigned: false, to: "neworders" };
    } catch (error) {
      console.log("err", error);
      return;
    }
  }
  const rrIndex = await getNextSequence("new-order");
  const staff = onlineStaffs[rrIndex % onlineStaffs.length];

  const order = await ShopOrder.create({
    ...orderData,
    userId: staff.userId,
    staffID: staff.staffID,
    final: {
      ...orderData.final,
      staff: staff.staffInfo.name,
    },
  });

  // ✅ notify assigned staff via socket
  if (io) {
    io.to(staff.staffID).emit("new-order", {
      staffID: staff.staffID,
      order,
    });
  }

  return { assigned: true, staff: staff.staffID, order };
}

// POST /new-orders/claim-morning
router.post("/new-orders/claim-morning", async (req, res) => {
  try {
    const { staffID, userId } = req.body;

    // 1. Prevent after 8:30 AM
    const now = new Date();
    const cutoff = getTodayCutoffGMT7();

    // console.log("now UTC   :", now.toISOString());
    // console.log("cutoff UTC:", cutoff.toISOString());
    // console.log("now GMT+7    :", new Date(now.getTime() + 7*3600*1000).toISOString());
    // console.log("cutoff GMT+7 :", new Date(cutoff.getTime() + 7*3600*1000).toISOString());

    if (now > cutoff) {
      return res.status(400).json({ message: "Đơn ngày hôm qua chỉ cập nhật trước 8:30 AM" });
    }

    // 2. Prevent multiple claims today
    const { startOfDay, endOfDay } = getDayRangeGMT7();
    const alreadyClaimed = await Staff.findOne({
      staffID,
      isMorningBatch: true,
      claimedAt: { $gte: startOfDay, $lt: endOfDay },
    });
    // console.log('alreadyClaimed', alreadyClaimed);
    if (alreadyClaimed) {
      return res.status(400).json({ message: "Bạn đã nhận đơn rồi" });
    }

    // 3. Load staff list once
    const staffList = await Staff.find({ role: "Sale-Staff" });
    const totalStaff = staffList.length;
    if (totalStaff === 0) {
      return res.status(400).json({ message: "Không có nhân viên sale nào được tìm thấy" });
    }

    // 4. Get total new orders ONCE for all staff (using a lock)
    const todayKey = getTodayKeyGMT7();
    let lock = await RedistributionLock.findOne({ date: todayKey, type: "morning-claim" });

    if (!lock) {
      const totalOrders = await NewOrder.countDocuments({ staffID: "" });
      console.log("totalOrders ", totalOrders);
      const perStaff = Math.floor(totalOrders / totalStaff);
      const leftover = totalOrders % totalStaff;

      lock = await RedistributionLock.create({
        date: todayKey,
        type: "morning-claim",
        perStaff,
        leftover,
        createdAt: now,
        isRedistribute: false,
      });
    }

    const perStaff = lock.perStaff;
    console.log("perStaff", perStaff);

    // 5. Fetch unclaimed orders for this staff
    const orders = await NewOrder.find({ staffID: "" })
      .sort({ createdAt: 1 })
      .limit(typeof perStaff === "number" && perStaff > 0 ? perStaff : 0);

    if (!orders.length) {
      return res.json({ message: "Không có đơn mới nào trong ngày hôm qua" });
    }

    // 6. Assign them
    const ids = orders.map((o) => o._id);
    await NewOrder.updateMany({ _id: { $in: ids } }, { $set: { staffID, claimedAt: now, isMorningBatch: true } });

    const staffInfo = await Staff.findOne({
      staffID,
    });
    if (!staffInfo) return res.status(400).json({ message: "Không có nhân viên sale nào được tìm thấy, staff id wrong." });
    await ShopOrder.insertMany(
      orders.map((o) => ({
        ...o.toObject(),
        staffID,
        userId,
        final: {
          ...o.final,
          staff: staffInfo.staffInfo.name,
        },
      }))
    );
    await Staff.findOneAndUpdate(
      { staffID },
      { $set: { isMorningBatch: true, claimedAt: new Date() } } // keep UTC
    );

    await NewOrder.deleteMany({ _id: { $in: ids } });

    res.json({ assigned: orders.length, orders, message: "Claim success" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Claim failed", error: err.message });
  }
});

export async function redistributeUnclaimed(triggerStaffID: string, triggerUserId: string) {
  // 1. Get today key
  const today = getTodayKeyGMT7();

  // 2. Update all new order
  // Why do I need this? Because if there are some problem the code will error but this code
  //  await NewOrder.updateMany({ _id: { $in: ids } }, { $set: { staffID: staff.staffID, claimedAt: new Date(), } }); added "staffID" already.
  // The next request, new order will return 0 new order because no order correct with condition const unclaimed = await NewOrder.find({ staffID: "" }).sort({ createdAt: 1 });
  const getAllNewOrder = await NewOrder.find().sort({ createdAt: -1 });
  if (!getAllNewOrder || getAllNewOrder.length === 0) return { message: "Không còn đơn nào", updates: [] };
  const arrayIds = getAllNewOrder.map((order) => {
    return order._id;
  });
  await NewOrder.updateMany({ _id: { $in: arrayIds } }, { $set: { staffID: "", claimedAt: new Date() } });

  //  Prevent after 8:30 AM
  const now = new Date();
  const cutoff = getTodayCutoffGMT7();
  if (now < cutoff) {
    return {
      message: `Phân phối lại chỉ được thực hiện sau 8:30`,
      updates: [],
    };
  }
  //3 Check if already done today
  const existingLock = await RedistributionLock.findOne({ date: today });
  if (existingLock && existingLock.isRedistribute) {
    return {
      message: ` ${existingLock.triggeredBy} lúc ${existingLock.triggeredAt}`,
      updates: [],
      locked: true,
    };
  }

  // 4. Get active staff, we need to get all staff data because when update order in ShopOrder we need userId field
  const { startOfDay, endOfDay } = getDayRangeGMT7();
  const activeStaff = await Staff.find({ isMorningBatch: true, role: "Sale-Staff", claimedAt: { $gte: startOfDay, $lt: endOfDay } });
  const arrayActiveStaffID = activeStaff.map((staffInfo) => {
    return staffInfo.staffID;
  });
  console.log("activeStaff", activeStaff.length);
  if (!activeStaff.length) {
    return { message: "Không có nhân viên online để phân phối lại", updates: [] };
  }

  // 5. Get unclaimed order
  const unclaimed = await NewOrder.find({ staffID: "" }).sort({ createdAt: 1 });
  if (!unclaimed.length) {
    return { message: "Không còn đơn nào để nhận", updates: [] };
  }

  const perStaff = Math.floor(unclaimed.length / activeStaff.length);
  let leftover = unclaimed.length % activeStaff.length;

  const updates: any[] = [];

  // 6. Evenly distribution for all online staff
  for (const staff of activeStaff) {
    const batch = unclaimed.splice(0, perStaff);
    if (!batch.length) continue;

    const ids = batch.map((o) => o._id);
    await NewOrder.updateMany({ _id: { $in: ids } }, { $set: { staffID: staff.staffID, claimedAt: new Date() } });

    await ShopOrder.insertMany(
      batch.map((o) => ({
        ...o.toObject(),
        staffID: staff.staffID,
        userId: staff.userId,
        final: {
          ...o.final,
          staff: staff.staffInfo.name,
        },
      }))
    );

    await NewOrder.deleteMany({ _id: { $in: ids } });

    updates.push({ staffID: staff.staffID, assigned: batch.length });
  }

  // If leftover > 0 → give ALL leftovers to best closer
  if (leftover > 0) {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    const staffDocs = await Staff.find({ staffID: { $in: arrayActiveStaffID } });
    let bestStaff: string | null = null;
    let bestRate = -1;
    let bestUserId = null;
    let bestStaffName = null;

    // let bestUserId: ObjectId | null = null;

    for (const s of staffDocs) {
      const rec = s.salaryHistory.find((r: any) => r.time === prevMonthStr);
      if (!rec) continue;
      const rate = rec.totalDistributionOrder > 0 ? rec.totalCloseOrder / rec.totalDistributionOrder : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestStaff = s.staffID;
        bestUserId = s.userId;
        bestStaffName = s.staffInfo.name;
      }
    }

    // fallback: if no history OR bestStaff absent → first active staff
    if (!bestStaff || !arrayActiveStaffID.includes(bestStaff)) {
      bestStaff = arrayActiveStaffID[0];
      bestUserId = activeStaff.find((s) => s.staffID === bestStaff)?.userId;
      bestStaffName = activeStaff.find((s) => s.staffID === bestStaff)?.staffInfo.name;
    }

    if (bestStaff) {
      const leftoverBatch = unclaimed.splice(0, leftover);
      if (leftoverBatch.length) {
        const ids = leftoverBatch.map((o) => o._id);
        await NewOrder.updateMany({ _id: { $in: ids } }, { $set: { staffID: bestStaff, claimedAt: new Date(), isMorningBatch: true } });

        await ShopOrder.insertMany(
          leftoverBatch.map((o) => ({
            ...o.toObject(),
            staffID: bestStaff,
            userId: bestUserId,
            final: {
              ...o.final,
              staff: bestStaffName,
            },
          }))
        );

        await NewOrder.deleteMany({ _id: { $in: ids } });

        // update the report
        const found = updates.find((u) => u.staffID === bestStaff);
        if (found) found.assigned += leftoverBatch.length;
        else updates.push({ staffID: bestStaff, assigned: leftoverBatch.length });
      }
    }
  }

  // Claim morning create RedistributeLock already, we just update it
  await RedistributionLock.findOneAndUpdate({ date: today }, { $set: { triggeredBy: triggerStaffID || "manager" }, isRedistribute: true });

  return { message: "Redistribution completed", updates, locked: false };
}

router.post("/new-orders/redistribute", async (req, res) => {
  try {
    const { staffID, userId } = req.body; // optional
    const result = await redistributeUnclaimed(staffID, userId);
    res.json(result);
  } catch (err: any) {
    console.log("err redis", err);
    res.status(500).json({ message: "Redistribution failed", error: err.message });
  }
});

// Manager view of stats
// routes/newOrderRoutes.ts

router.get("/new-orders/manager-stats", async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setHours(8, 30, 0, 0);

    // Get all sale staff
    const allStaff = await Staff.find({}, { staffID: 1, "staffInfo.name": 1 });

    // Staff who claimed before 8:30
    const claimed = await ShopOrder.aggregate([
      { $match: { isMorningBatch: true, createdAt: { $lt: cutoff } } },
      { $group: { _id: "$staffID", count: { $sum: 1 } } },
    ]);

    // Convert aggregation into map
    const claimedMap = claimed.reduce((acc: any, c: any) => {
      acc[c._id] = c.count;
      return acc;
    }, {});

    // Count unclaimed orders
    const totalUnclaimed = await NewOrder.countDocuments({ staffID: null });

    // Mark absent staff
    const staffStats = allStaff.map((staff) => ({
      staffID: staff.staffID,
      name: staff.staffInfo?.name || "",
      claimed: claimedMap[staff.staffID] || 0,
      status: claimedMap[staff.staffID] ? "Present" : "Absent",
    }));

    res.json({
      unclaimed: totalUnclaimed,
      staffStats,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to load manager stats", error: err.message });
  }
});

// Helper: get next sequence number for a prefix
async function getNextSequence(prefix: string) {
  const counter = await Counter.findOneAndUpdate(
    { prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true } // create if not exists
  );
  return counter.seq;
}

export default router;

// helper: get previous YYYY-MM string
function getPrevMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// get staff closing rate
async function getStaffRates(month: string) {
  let staffs = await Staff.find({ "salaryHistory.time": month });
  if (!staffs.length) {
    const prev = getPrevMonth(month);
    staffs = await Staff.find({ "salaryHistory.time": prev });
    month = prev;
  }

  return staffs.map((s) => {
    const rec = s.salaryHistory.find((r: any) => r.time === month);
    const rate = rec && rec.totalDistributionOrder > 0 ? rec.totalCloseOrder / rec.totalDistributionOrder : 0;
    return { staffID: s.staffID, rate, staff: s };
  });
}
export async function getTopCloser(month: string) {
  // 1. Try given month
  let staffs = await Staff.find({ "salaryHistory.time": month });
  let usedMonth = month;

  // 2. If no data, fallback to previous month
  if (!staffs.length) {
    const prevMonth = getPrevMonth(month);
    staffs = await Staff.find({ "salaryHistory.time": prevMonth });
    usedMonth = prevMonth;
  }

  if (!staffs.length) {
    return { message: "No salary data available", topStaff: null, usedMonth };
  }

  let topStaff: any = null;
  let maxRate = -1;

  for (const staff of staffs) {
    const record = staff.salaryHistory.find((r: any) => r.time === usedMonth);
    if (!record || record.totalDistributionOrder === 0) continue;

    const rate = (record.totalCloseOrder / record.totalDistributionOrder) * 100;

    if (rate > maxRate) {
      maxRate = rate;
      topStaff = {
        staffID: staff.staffID,
        name: staff.staffInfo?.name || "",
        rate: parseFloat(rate.toFixed(2)),
        totalCloseOrder: record.totalCloseOrder,
        totalDistributionOrder: record.totalDistributionOrder,
      };
    }
  }

  return topStaff ? { message: "Top closer found", topStaff, usedMonth } : { message: "No valid data for this month or previous month", usedMonth };
}

router.get("/top-closer/:month", async (req, res) => {
  try {
    const { month } = req.params; // e.g. "2025-10"
    const result = await getTopCloser(month);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to get top closer", error: err.message });
  }
});

// Shift any date to GMT+7
export function toGMT7(date: Date): Date {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

// Return cutoff (08:30 GMT+7 today) as a UTC Date
export function getTodayCutoffGMT7(): Date {
  const now = new Date();

  // get "today" in GMT+7
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();

  // cutoff 08:30 GMT+7 in UTC = 08:30 - 7h = 01:30 UTC
  const cutoffUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate, 7, 23, 0, 0));

  return cutoffUTC;
}

// ✅ Return YYYY-MM-DD in GMT+7
export function getTodayKeyGMT7(): string {
  const now = new Date();

  // shift into GMT+7
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Start/end of day GMT+7 (as UTC dates)
export function getDayRangeGMT7() {
  const now = new Date();

  // Convert to GMT+7
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const date = local.getUTCDate();

  // Start/end of day in GMT+7 → convert back to UTC
  const startOfDay = new Date(Date.UTC(year, month, date, -7, 0, 0, 0)); // 00:00 GMT+7
  const endOfDay = new Date(Date.UTC(year, month, date, 17, 59, 59, 999)); // 23:59:59 GMT+7

  return { startOfDay, endOfDay };
}
