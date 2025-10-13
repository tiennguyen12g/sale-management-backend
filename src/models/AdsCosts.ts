import mongoose, { Schema, Document } from "mongoose";

export type PlatformName = "TikTok" | "Facebook" | "Shopee";

export interface IAdsCost extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 tie to User
  platform: PlatformName;
  date: string; // YYYY-MM-DD
  spendActual: number;
  ordersDelivered: number;
  ordersReturned: number;
  netRevenue: number;
  platformFee?: number;
  returnFee?: number;
  targetProduct?: string;
  idProduct?: string;
}

const AdsCostSchema = new Schema<IAdsCost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    platform: {
      type: String,
      enum: ["TikTok", "Facebook", "Shopee"],
      required: true,
    },
    date: { type: String, required: true },
    spendActual: { type: Number, required: true },
    ordersDelivered: { type: Number, required: true },
    ordersReturned: { type: Number, required: true },
    netRevenue: { type: Number, required: true },
    platformFee: { type: Number },
    returnFee: { type: Number },
    targetProduct: { type: String },
    idProduct: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IAdsCost>("AdsCost", AdsCostSchema);
