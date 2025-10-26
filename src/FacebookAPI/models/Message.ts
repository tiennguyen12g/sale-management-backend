// models/Message.ts
import { Schema, model, Document } from "mongoose";

export interface IMessage extends Document {
  pageId: string;
  pageName?: string;

  conversationId: string; // reference (string, from Conversation._id or conversationId you use)
  facebookMessageId?: string; // Facebook's message ID

  senderType: "customer" | "agent" | "bot" | "shop" | string;
  senderId?: string; // external id (customer) or internal staff id
  recipientId?: string; // for shop messages, the recipient is the customer
  
  content: string; // text or URL
  contentType: "text" | "image" | "video" | "file" | "sticker" | "fallback" | string;
  timestamp: Date;
  status?: "sent" | "delivered" | "seen" | "failed" | "sending";
  attachments?: {
    type: "text" | "image" | "video" | "file" | "sticker" | "fallback" | string;
    payload: {
      url?: string;
      attachment_id?: string;
      [k: string]: any;
    }
    [k: string]: any;
  }[]

  metadata?: {
    fileName?: string;
    fileSize?: number;
    thumbnail?: string;
    mimeType?: string;
      facebookURL?: string; // actual CDN URL
  attachmentId?: string;
    [k: string]: any;
  };
  replyTo?: {
    senderName: string;
    content: string;
    messageIdRoot: string;
    replyContentType:  "text" | "image" | "video" | "file" | "sticker" | "fallback" | string;
  };
}

const MessageSchema = new Schema<IMessage>(
  {
    pageId: { type: String, required: true },
    pageName: String,

    conversationId: { type: String, required: true, index: true },
    facebookMessageId: String,

    senderType: { type: String, required: true },
    senderId: String,
    recipientId: String,

    content: { type: String, required: true },
    contentType: { type: String, required: true, default: "text" },
    timestamp: { type: Date, required: true },
    status: String,

    metadata: Schema.Types.Mixed,

    attachments: [Schema.Types.Mixed],

    replyTo: {
      senderName: String,
      content: String,
      messageIdRoot: {type: String, default: "none"},
      replyContentType: { type: String, default: "text" },
    },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, timestamp: -1 });

export const Message = model<IMessage>("Message", MessageSchema);
