import mongoose, { Schema, Document } from "mongoose";

export interface IProductDetail {
  name: string;
  stock: number;
  color: string;
  size: string;
  price: number;
  weight: number;
  breakEvenPrice: number;
}

export interface IImageUrl {
  name: string;
  color: string;
  url: string;
}

export interface IProduct extends Document {
  userId?: mongoose.Types.ObjectId; // 🔑 link to User
  productId: string;
  name: string;
  typeProduct: string;
  sizeAvailable: string[];
  colorAvailable: string[];
  productDetailed: IProductDetail[];
  imageUrl: IImageUrl[];
  endpointUrl: string;
  material?: string;
  description?: string;
  category?: string;
  stock?: number;
  supplier?: string;
  tags?: string[];
  warranty?: string;
  salesCount?: number;
  notes?: string;
}

const ProductSchema = new Schema<IProduct>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", },
    productId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    typeProduct: { type: String, required: true },
    sizeAvailable: { type: [String], default: [] },
    colorAvailable: { type: [String], default: [] },
    endpointUrl: { type: String, required: true },
    productDetailed: [
      {
        name: String,
        stock: Number,
        color: String,
        size: String,
        price: Number,
        weight: Number,
        breakEvenPrice: Number,
      },
    ],
    imageUrl: [
      {
        name: String,
        color: String,
        url: String,
      },
    ],

    material: String,
    description: String,
    category: String,
    stock: Number,
    supplier: String,
    tags: [String],
    warranty: String,
    salesCount: Number,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model<IProduct>("Product", ProductSchema);
