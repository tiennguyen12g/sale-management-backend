import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { IPageInfo } from "../FacebookAPI/models/PageInfo.js";

export interface ISocialData {
  id: string;
  name: string;
  accessToken: string;

  email?: string;
  pictureURL?: string;
  phone?: string;
  address?: string;
  pages?: IPageInfo[];
}
interface TagType {
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
// export const exapmleTagList = ["Chốt-Đang đóng hàng", "Đã gửi hàng", "Khách hủy", "Không trả lời", "Đã nhận hàng"]
export type AdministratorTypes = "tnbt12g" | "normal" | "manager" | "staff" | string;
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  staffRole: string;
  isCreateProfile: boolean;
  registeredDate: string;
  administrator: AdministratorTypes;
  comparePassword(candidate: string): Promise<boolean>;
  socialData?: {
    facebook?: ISocialData;
    instagram?: ISocialData;
    zalo?: ISocialData;
    tiktok?: ISocialData;
    shopee?: ISocialData;
  };
  settings: {
    shopTagList: TagType[];
    [k: string]: any;
  };
}

const UserSchema: Schema<IUser> = new Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    staffRole: { type: String, required: true },
    isCreateProfile: { type: Boolean, required: true },
    registeredDate: { type: String, required: true },
    socialData: {
      facebook: { type: Schema.Types.Mixed },
      instagram: { type: Schema.Types.Mixed },
      zalo: { type: Schema.Types.Mixed },
      tiktok: { type: Schema.Types.Mixed },
      shopee: { type: Schema.Types.Mixed },
    },
    administrator: { type: String, required: true, default: "normal" },
    settings: {
      shopTagList: { type: [{ id: String, tagName: String, color: String }], default: [...exapmleTagList] },
    },
  },
  { timestamps: true }
);

// hash password before save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
