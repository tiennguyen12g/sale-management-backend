// models/PageInfo.ts
import { Schema, model, Document } from "mongoose";

export interface ITempoarayStoreLocalMsg extends Document {
    localMsg_Id: string;
    facebookMsg_Id: string;

}

const TemporaryStoreLocalMsgSchema = new Schema<ITempoarayStoreLocalMsg>(
  {
    localMsg_Id: { type: String, required: true },
    facebookMsg_Id: { type: String, required: true, index: true },

  },
  { timestamps: true }
);

export const TempoarayStoreLocalMsg = model<ITempoarayStoreLocalMsg>("TempoarayStoreLocalMsg", TemporaryStoreLocalMsgSchema);
