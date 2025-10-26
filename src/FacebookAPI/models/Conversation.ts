// models/Conversation.ts
import mongoose, { Schema, model, Document } from "mongoose";

export interface PurchasedHistoryType{
  orderCode: string;
  time: string;
  shippingStatus: string;
}
export interface IConversation extends Document {
  platform: "facebook" | "zalo" | "tiktok" | "instagram" | string | "website" | "shopee";

  pageId: string;
  pageName?: string;

  assignedStaffId:  string; //mongoose.Types.ObjectId; // 🔑 link to User
  assignedStaffName?: string;

  customerId: string; // external sender id (facebook psid)
  customerName?: string;
  customerAvatarURL?: string;
  customerPhone?: string;

  lastMessage?: string;
  lastMessageAt?: string | number;
  unreadCount: number;

  isMuted?: boolean;
  isPinned?: boolean;
  tags?: {
    id: string;
    tagName: string,
    color: string,
  };

}



const ConversationSchema = new Schema<IConversation>(
  {
    platform: { type: String, required: true, default: "facebook" },

    pageId: { type: String, required: true, index: true },
    pageName: String,

    assignedStaffId: { type: String, required: true, default: "" }, // { type: Schema.Types.ObjectId, ref: "User", required: true }, 
    assignedStaffName: String,

    customerId: { type: String, required: true, index: true },
    customerName: String,
    customerAvatarURL: String,
    customerPhone: String,

    lastMessage: String,
    lastMessageAt: String || Number,
    unreadCount: { type: Number, default: 0 },

    isMuted: Boolean,
    isPinned: Boolean,
    tags: {
      id: String,
      tagName: String,
      color: String,
    },


  },
  { timestamps: true }
);

ConversationSchema.index({ pageId: 1, lastMessageAt: -1 });

export const Conversation = model<IConversation>("Conversation", ConversationSchema);
