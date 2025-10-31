// models/PageInfo.ts
import mongoose,  { Schema, model, Document } from "mongoose";

export interface IPageInfo extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 link to User
  pageId: string; // pageId is the real fanpage id for Facebook and is shopId for Tiktok Shopee
  pageName: string;
  pageAccessToken: string;
  platform: "facebook" | "instagram" | "zalo" | "tiktok" | "shopee" | string;
  meta?: Record<string, any>;
  pageAvatarURL?: string;
  refeshTokenAt: string;

}

const PageInfoSchema = new Schema<IPageInfo>(
  {
userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
    pageId: { type: String, required: true, index: true },
    pageName: { type: String, required: true },
    pageAccessToken: { type: String, required: true },
    platform: { type: String, default: "facebook", required: true },
    meta: { type: Schema.Types.Mixed },
    pageAvatarURL: String,
    refeshTokenAt: String,
  },
  { timestamps: true }
);

export const PageInfo = model<IPageInfo>("PageInfo", PageInfoSchema);
