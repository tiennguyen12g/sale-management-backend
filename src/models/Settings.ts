import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

//-- Tags setting
export interface TagType {
  id: string;
  tagName: string;
  color: string;
  description?: string;
}
export const exapmleTagList: TagType[] = [
  { id: uuidv4(), tagName: "Chốt-Đang đóng hàng", color: "#00b11dff" },
  { id: uuidv4(), tagName: "Đã gửi hàng", color: "#d10374ff" },
  { id: uuidv4(), tagName: "Khách hủy", color: "#e40000ff" },
  { id: uuidv4(), tagName: "Không trả lời", color: "#b8b8b8ff" },
  { id: uuidv4(), tagName: "Đã nhận hàng", color: "#04aa2dff" },
];

// -- Fast message config.
export interface FastMessageType {
  id: string;
  keySuggest: string;
  listMediaUrl: { id: string; url: string, type: "image" | "video" }[];
  messageContent: string;
}

// -- Favorit album

export interface FavoritAlbum {
  id: string;
  nameImage: string;
  url: string;
}

export interface ISettings extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 tie to User
  shopTagList: TagType[];
  fastMessages: FastMessageType[];
  favoritAlbum: FavoritAlbum[];
}
const SettingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopTagList: { type: [{ id: String, tagName: String, color: String }], default: [...exapmleTagList] },
    fastMessages: { type: [{id: String, keySuggest: String, listMediaUrl: [{ id: String, url: String, type: { type: String, enum: ["video", "image"] } }], messageContent: String }], default: [] },
    favoritAlbum: {type: [{id: String, nameImage: String,url: String}],default: []},
  },
  { timestamps: true }
);

export default mongoose.model<ISettings>("Settings", SettingsSchema);
