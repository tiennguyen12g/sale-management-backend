import mongoose, { Schema, Document } from "mongoose";

export interface IMoneyBankAccount extends Document {
        userId: mongoose.Types.ObjectId;   // 🔑 link to User
  owner: string;
  bankName: string;
  shortName: string;
  bankAccountNumber: number;
  type: "normal" | "visa" | "virtual";
  balance: number;
  revenueAdded?: number;
  date?: string;
  note?: string;
}

const MoneyBankAccountSchema = new Schema<IMoneyBankAccount>(
  {
     userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
    owner: { type: String, required: true },
    bankName: { type: String, required: true },
    shortName: { type: String, required: true },
    bankAccountNumber: { type: Number, required: true, unique: true },
    type: { type: String, enum: ["normal", "visa" , "virtual"], required: true },
    balance: { type: Number, required: true, default: 0 },
    revenueAdded: { type: Number,  default: 0 },
    date: { type: String }, // ISO date string
    note: { type: String },
  },
  { timestamps: true }
);

const MoneyBankAccount = mongoose.model<IMoneyBankAccount>(
  "MoneyBankAccount",
  MoneyBankAccountSchema,
  "bankaccounts"
);

export default MoneyBankAccount;
