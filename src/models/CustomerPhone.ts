import mongoose, { Schema, Document } from "mongoose";

export type PlatformName = "TikTok" | "Facebook" | "Shopee";
export interface PurchasedHistoryType{
  orderCode: string;
  time: string;
  shippingStatus: string;
}
export interface ICustomerPhone extends Document {
  phone: string;
  address: string;
  totalOrder:number;
  successOrder: number,
  failedOrder: number,
  orderInShipping: number;
  purchasedHistory: PurchasedHistoryType[]
}

const CustomerPhoneSchema = new Schema<ICustomerPhone>(
  {
    phone: {type: String, required: true},
    address: String,
    totalOrder: Number,
    successOrder: Number,
    failedOrder: Number,
    orderInShipping: Number,
    purchasedHistory: {
      type: [
        {
          orderCode: { type: String, required: true },
          time: { type: String, required: true },
          shippingStatus: { type: String, required: true }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model<ICustomerPhone>("CustomerPhone", CustomerPhoneSchema);
