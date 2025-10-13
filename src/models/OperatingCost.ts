import mongoose, { Schema, Document } from "mongoose";

export interface IOperatingCost extends Document {
    userId: mongoose.Types.ObjectId;   // 🔑 link to User
  action: "electric" | "water" | "internet" | "phone" | "software" | "othercost";
  date: string; // ISO date string
  value: number;
  usedFor: string;
  note: string;
}

const OperatingCostSchema = new Schema<IOperatingCost>(
  {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
    action: {
      type: String,
      enum: ["electric", "water", "internet", "phone", "software", "othercost"],
      required: true,
    },
    date: { type: String, required: true }, // store ISO string
    value: { type: Number, required: true },
    usedFor: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const OperatingCost = mongoose.model<IOperatingCost>("OperatingCost", OperatingCostSchema);

export default OperatingCost;
