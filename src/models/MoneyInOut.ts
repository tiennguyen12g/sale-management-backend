import mongoose, { Schema, Document } from "mongoose";


export type MoneyInOut_Action_Type = "deposit" | "withdraw" | "payment" | "send";
export type MoneyInOut_SourceFund_Type = "Original" | "Flexible" | "Tiktok" | "Facebook" | "Shopee" | "Carrier" |"NetCash" | "Visa" | "Receive";
export type MoneyInOut_DestinationFund_Type = "Original" | "Flexible" | "Tiktok" | "Facebook" | "Shopee" | "Carrier" | "Tax" | "Operating" | "NetCash" | "Visa" | "Receive" | "Import" | "Salary" | "Others";

export interface IMoneyInOut extends Document {
      userId: mongoose.Types.ObjectId;   // 🔑 link to User
  action: MoneyInOut_Action_Type;
  date: string; // using string ISO format for JSON
  value: number;
  usedFor: string;
  note: string;
  sourceFund: "Original" | "Flexible" | "Tiktok" | "Facebook" | "Shopee" | "Carrier" | "Operating" | "NetCash" | "Visa" | "Receive";
  destinationFund: "Original" | "Flexible" | "Tiktok" | "Facebook" | "Shopee" | "Carrier" | "Tax" | "Operating" | "NetCash" | "Visa" | "Receive" | "Import" | "Salary" | "Others";
}

const MoneyInOutSchema = new Schema<IMoneyInOut>(
  {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
    action: {
      type: String,
      enum: ["deposit" , "withdraw" , "payment", "send"],
      required: true,
    },
    date: { type: String, required: true }, // store ISO string
    value: { type: Number, required: true },
    usedFor: { type: String, required: true },
    note: { type: String, default: "" },
    sourceFund: {
      type: String, 
      enum: ["Original" , "Flexible" , "Tiktok" , "Facebook" , "Shopee" , "Carrier", "Operating", "NetCash", "Visa", "Receive"],
      required: true
    },
    destinationFund: {
      type: String, 
      enum: ["Original" , "Flexible" , "Tiktok" , "Facebook" , "Shopee" , "Carrier", "Tax", "Operating", "NetCash", "Visa", "Receive", "Import", "Salary", "Others"],
      required: true
    }
  },
  { timestamps: true }
);

const MoneyInOut = mongoose.model<IMoneyInOut>("MoneyInOut", MoneyInOutSchema, "moneyinouts");

export default MoneyInOut;
