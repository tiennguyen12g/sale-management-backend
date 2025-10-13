import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  weight: number;
  isBroken: boolean;
}

export interface DeliveryDetails {
  carrierCode: string; // B:10
  orderCode: string; //C:10 
  sendTime: string; //D:10
  whoPayShipingFee: string; //V:10
  deliveryStatus: string; //AG:10
  totalFeeAndVAT: number; // Z:10
  receivedCOD: string; //AI:10
  timeForChangeStatus: string; //AP:10
  shipCompany: string;
  shippedTime: string;
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
    promotions: Promotions
}


const OrderItemSchema = new Schema<IOrderItem>({
  name: String,
  color: String,
  size: String,
  quantity: Number,
  price: Number,
  weight: Number,
  isBroken: Boolean,
});

const DeliveryDetailsSchema = new Schema<DeliveryDetails>({
  carrierCode: String, // B:10
  orderCode: String, //C:10 
  sendTime: String, //D:10
  whoPayShipingFee: String, //V:10
  deliveryStatus: String, //AG:10
  totalFeeAndVAT: Number, // Z:10
  receivedCOD: String, //AI:10
  timeForChangeStatus: String, //AP:10
  shipCompany: String,
  shippedTime: String,
})
export interface IShopOrder extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 who created the order
  productId: string;
  orderCode: string;
  staffID: string;
  original: OriginalOrder;
  final: FinalOrder;
  deliveryDetails: DeliveryDetails;
  stockAdjusted: boolean;
}
interface Promotions {
  shipTags: "none" | "freeship";
  discount: number;
}

const ShopOrderSchema = new Schema<IShopOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: String, required: true },
    orderCode: { type: String, required: true },
    staffID: { type: String, required: true },
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
      promotions: {
        shipTags: { type: String, enum: ["none", "freeship"], default: "none" },
        discount: { type: Number, default: 0 },
      }
    },
    deliveryDetails: DeliveryDetailsSchema,
    stockAdjusted: Boolean
  },
  { timestamps: true }
);

export default mongoose.model<IShopOrder>("ShopOrder", ShopOrderSchema);
