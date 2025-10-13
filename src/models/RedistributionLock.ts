// models/RedistributionLock.ts
import mongoose from "mongoose";

const redistributionLockSchema = new mongoose.Schema({
  date: { type: String, required: true }, // format YYYY-MM-DD
  type: String,
  perStaff: Number,
  leftover: Number,
  isRedistribute: Boolean,
  triggeredBy: { type: String }, // staffID or managerID
  triggeredAt: { type: Date, default: Date.now },
});

export default mongoose.model("RedistributionLock", redistributionLockSchema);
