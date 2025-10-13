import mongoose, { Schema, Document } from "mongoose";

export interface InventoryRecord extends Document {
   userId: mongoose.Types.ObjectId; // 🔑 who created the order
  productId: string;
  productName: string;
  currentStock: number;
  averageCost: number;
  totalValue: number;
  warehouseName: string;
  note?: string;
}

const InventoryRecordSchema = new Schema<InventoryRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: String,
    productName: String,
    currentStock: Number,
    averageCost: Number,
    totalValue: Number,
    warehouseName: String,
    note: String,
  },
  { timestamps: true }
);

export default mongoose.model<InventoryRecord>("InventoryRecord", InventoryRecordSchema);
