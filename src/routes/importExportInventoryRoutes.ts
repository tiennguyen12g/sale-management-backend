import { Router } from "express";
import multer from "multer";
import fs from "fs";
import ImportRecord from "../models/ImportRecord.js";
import ExportRecord from "../models/ExportRecord.js";
import InventoryRecord from "../models/InventoryRecord.js";
import Product from "../models/Product.js";
import { IProduct, IProductDetail } from "../models/Product.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import mongoose from "mongoose";

export interface ImportProductDetailsType {
  name: string;
  importQuantity: number;
  brokenQuantity: number;
  addStock: number;
  color: string;
  size: string;
  price: number;
  weight: number;
  breakEvenPrice: number;
}
const router = Router();
const upload = multer({ dest: "uploads/" });

async function loadXLSX() {
  const mod = await import("xlsx");
  return (mod as any).default || mod;
}

function getModel(target: string): mongoose.Model<any> | null {
  switch (target) {
    case "import":
      return ImportRecord;
    case "export":
      return ExportRecord;
    case "inventory":
      return InventoryRecord;
    default:
      return null;
  }
}

// ✅ Get all (for user or admin)
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { staffRole } = req.user!;
    const query = staffRole === "admin" ? {} : { userId: req.userId };

    const [imports, exports, inventory] = await Promise.all([
      ImportRecord.find(query).sort({ createdAt: -1 }),
      ExportRecord.find(query).sort({ createdAt: -1 }),
      InventoryRecord.find(query).sort({ createdAt: -1 }),
    ]);

    res.json({ imports, exports, inventory });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ message: "Failed to fetch records", error: String(err) });
  }
});

// ✅ Upload Excel
router.post("/upload-excel/:target", authMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const target = req.params.target;
    const Model = getModel(target);
    if (!Model) return res.status(400).json({ message: "Invalid target type" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const XLSX = await loadXLSX();
    const buf = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const docs = rows.map((r: any) => ({ ...r, userId: req.userId }));
    await Model.insertMany(docs);

    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    res.json({ message: "Data uploaded", count: docs.length });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: String(err) });
  }
});

// ✅ Add new record
// ✅ Add new record (Import or Export) and sync to Product Model
router.post("/:target", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const Model = getModel(req.params.target);
    if (!Model) return res.status(400).json({ message: "Invalid target" });

    // ✅ Save Import record
    const newItem = new Model({ ...req.body, userId: req.userId });
    const saved = await newItem.save();
    console.log('dfsd', req.body.warehouseName);

    // ✅ Only handle Product stock update if this is an Import
    if (req.params.target === "import") {
      const importDetails: ImportProductDetailsType[] = req.body.importDetails || [];
      const productId: string = req.body.productId;
      const productName: string = req.body.productName;

      let existingProduct = await Product.findOne({ productId });

      if (existingProduct) {
        // ✅ Update existing product stock
        const newProductDetailed = [...existingProduct.productDetailed];
        const sizeAvailable = [...existingProduct.sizeAvailable];
        const colorAvailable = [...existingProduct.colorAvailable];
        let newSize = [...sizeAvailable];
        let newColor = [...colorAvailable];
        importDetails.forEach((importItem) => {
          const idx = newProductDetailed.findIndex((item) => item.color === importItem.color && item.size === importItem.size);

          if (idx !== -1) {
            // ✅ Update existing variant
            const existing = newProductDetailed[idx];
            const newTotalStock = existing.stock + importItem.addStock;

            const weightedPrice = (existing.breakEvenPrice * existing.stock + importItem.breakEvenPrice * importItem.addStock) / newTotalStock;

            existing.breakEvenPrice = Math.ceil(weightedPrice / 1000) * 1000;
            existing.stock = newTotalStock;
          } else {
            // ✅ Add new variant

            if (!sizeAvailable.includes(importItem.size)) {
              newSize = [...sizeAvailable, importItem.size];
            }
            if (!colorAvailable.includes(importItem.color)) {
              newColor = [...colorAvailable, importItem.color];
            }
            newProductDetailed.push({
              name: importItem.name || productName,
              stock: importItem.addStock,
              color: importItem.color,
              size: importItem.size,
              price: 0,
              weight: importItem.weight,
              breakEvenPrice: importItem.breakEvenPrice,
            });
          }
        });

        await Product.findOneAndUpdate({ productId }, { productDetailed: newProductDetailed, sizeAvailable: newSize, colorAvailable: newColor }, { new: true });
      } else {
        // ✅ Create new product entirely
        const productDetailed: IProductDetail[] = importDetails.map((item) => ({
          name: item.name || productName,
          stock: item.addStock,
          color: item.color,
          size: item.size,
          price: 0,
          weight: item.weight,
          breakEvenPrice: item.breakEvenPrice,
        }));

        const newProduct = new Product({
          productId,
          name: productName,
          typeProduct: "none",
          sizeAvailable: req.body.sizeAvailable,
          colorAvailable: req.body.colorAvailable,
          endpointUrl: "none",
          tags: [],
          imageUrl: [],
          productDetailed,
        });

        await newProduct.save();
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error("err", err);
    res.status(400).json({ message: "Failed to add record", error: String(err) });
  }
});

// ✅ Update record
router.put("/:target/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const Model = getModel(req.params.target);
    if (!Model) return res.status(400).json({ message: "Invalid target" });

    const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update record", error: String(err) });
  }
});

// ✅ Delete record
router.delete("/:target/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const Model = getModel(req.params.target);
    if (!Model) return res.status(400).json({ message: "Invalid target" });

    await Model.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete record", error: String(err) });
  }
});

export default router;
