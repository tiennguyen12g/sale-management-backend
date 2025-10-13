import mongoose, { Schema, Document } from "mongoose";

interface OtherFees {
  value: number;
  usedFor: string;
  date: string;
  note?: string;
}

export interface ImportProductDetailsType {
  name: string;
  importQuantity: number;
  brokenQuantity: number;
  addStock: number;
  color: string;
  size: string;
  price: number;
  weight: number;
  breakEvenPrice: number;
}

export interface ImportRecord extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 who created the order
  time: string;
  productId: string;
  productName: string;
  importQuantity: number;
  addedQuantity: number;
  brokenQuantity: number;
  pricePerUnit: number;
  breakEvenPrice: number;
  supplier?: string;
  batchCode: string;
  shippingFee: {
    externalChinaToVietnam: number;
    internalVietnamToWarehouse: number;
  };
  otherFees: OtherFees[];
  totalCost: number;
  totalShipment: number;
  note?: string;
  shipmentStatus: string;
  revenue?: number;
  profit?: number;
  estimateSellingPrice?: number;
  importDetails: ImportProductDetailsType[];
  sizeAvailable: string[];
  colorAvailable: string[];
    warehouseName: string;
}

const ImportRecordSchema = new Schema<ImportRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    time: String,
    productId: String,
    productName: String,
    importQuantity: Number,
    addedQuantity: Number,
    brokenQuantity: Number,
    pricePerUnit: Number,
    breakEvenPrice: Number,
    supplier: String,
    batchCode: String,
    shippingFee: {
      externalChinaToVietnam: Number,
      internalVietnamToWarehouse: Number,
    },
    otherFees: [{ value: Number, usedFor: String, date: String, note: String }],
    totalCost: Number,
    totalShipment: Number,
    note: String,
    shipmentStatus: String,
    revenue: Number,
    profit: Number,
    estimateSellingPrice: Number,
    importDetails: [
      {
        name: String,
        importQuantity: Number,
        brokenQuantity: Number,
        addStock: Number,
        color: String,
        size: String,
        price: Number,
        weight: Number,
        breakEvenPrice: Number,
      },
    ],
    sizeAvailable: [String],
    colorAvailable: [String],
      warehouseName: String,
  },
  { timestamps: true }
);

export default mongoose.model<ImportRecord>("ImportRecord", ImportRecordSchema);
