import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  weight: number;
}

export interface OriginalOrder {
  time: string;
  customerName: string;
  phone: string;
  address: string;
  orderInfo: IOrderItem[];
  total: number;
  totalProduct: number;
  totalWeight: number;
  note: string;
  staff: string;
  buyerIP: string;
  website: string;
  facebookLink?: string;
  tiktokLink?: string;
}

export interface FinalOrder {
  orderCode: string;
  time: string;
  customerName: string;
  phone: string;
  address: string;
  orderInfo: IOrderItem[];
  total: number;
  totalProduct: number;
  totalWeight: number;
  note: string;
  status: string;
  confirmed: boolean;
  staff: string;
  buyerIP: string;
  website: string;
  deliveryStatus: string;
  deliveryCode: string;
  historyChanged?: { event: string; time: string }[];
  facebookLink?: string;
  tiktokLink?: string;
}

export interface IShopOrder extends Document {
  //   userId: mongoose.Types.ObjectId; // 🔑 who created the order
  productId: string;
  orderCode: string;
  staffID: string;
  original: OriginalOrder;
  final: FinalOrder;
  claimedAt: string;
  isMorningBatch: boolean;
}

const OrderItemSchema = new Schema<IOrderItem>({
  name: String,
  color: String,
  size: String,
  quantity: Number,
  price: Number,
  weight: Number,
});

const NewOrderSchema = new Schema<IShopOrder>(
  {
    // userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: String, required: true },
    orderCode: { type: String, required: true },
    staffID: { type: String },
    claimedAt: { type: String, default: null },
    isMorningBatch: { type: Boolean, default: false },
    original: {
      time: { type: String, required: true },
      customerName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      orderInfo: [OrderItemSchema],
      total: Number,
      totalProduct: Number,
      totalWeight: Number,
      note: String,
      status: String,
      staff: String,
      buyerIP: String,
      website: String,
      facebookLink: String,
      tiktokLink: String,
    },
    final: {
      orderCode: { type: String, required: true },
      time: { type: String, required: true },
      customerName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      orderInfo: [OrderItemSchema],
      total: Number,
      totalProduct: Number,
      totalWeight: Number,
      note: String,
      status: String,
      confirmed: { type: Boolean, default: false },
      staff: String,
      buyerIP: String,
      website: String,
      deliveryStatus: String,
      deliveryCode: String,
      historyChanged: [{ event: String, time: String }],
      facebookLink: String,
      tiktokLink: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IShopOrder>("NewOrder", NewOrderSchema);
