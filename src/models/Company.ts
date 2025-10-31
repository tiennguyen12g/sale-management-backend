// models/PageInfo.ts
import mongoose, { Schema, model, Document } from "mongoose";

export interface IListShop {
  pageId: string; // pageId is the real fanpage id for Facebook and is shopId for Tiktok Shopee
  platform: "facebook" | "instagram" | "zalo" | "tiktok" | "shopee" | string;
  pageName: string;
}

export interface IListStaff {
    staffID: string;
    
}
export interface ICompany extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 link to User
  listShop: IListShop[];
}

const CompanySchema = new Schema<ICompany>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
  },
  { timestamps: true }
);

export const Company = model<ICompany>("Company", CompanySchema);
