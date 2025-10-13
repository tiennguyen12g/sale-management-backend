import mongoose, { Schema, Document } from "mongoose";

export interface ExportRecord extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 who created the order
  time: string;
  productId: string;
  productName: string;
  exportQuantity: number;
  receiver: string;
  breakEvenPrice?: number;
  note?: string;
  batchCode?: string;
}

const ExportRecordSchema = new Schema<ExportRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    time: String,
    productId: String,
    productName: String,
    exportQuantity: Number,
    receiver: String,
    breakEvenPrice: Number,
    note: String,
    batchCode: String,
  },
  { timestamps: true }
);

export default mongoose.model<ExportRecord>("ExportRecord", ExportRecordSchema);
