import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface MediaLinkedType{
id: string;
url: string, 
type: "image" | "video"
}

export interface IShopMedia extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 tie to User
  shopId: string; // this is pageId for Facebook, the same shopId for Shopee and Tiktok
  images: {id: string; name: string, url: string}[]
  videos: {id: string; name: string, url: string}[]

}
const ShopMediaSchema = new Schema<IShopMedia>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopId: {type: String, required: true},
    images: [{id: String, name: String, url: String}],
    videos: [{id: String, name: String, url: String}],
  },
  { timestamps: true }
);

export default mongoose.model<IShopMedia>("ShopMedia", ShopMediaSchema);
