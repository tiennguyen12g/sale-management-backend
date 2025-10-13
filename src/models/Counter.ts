// models/Counter.ts
import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema({
  prefix: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }, // sequence number
});

export default mongoose.model("Counter", counterSchema);
