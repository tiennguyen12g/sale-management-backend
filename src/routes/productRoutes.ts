import { Router } from "express";
import Product from "../models/Product.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";

// Save files to /uploads/productImages
const upload = multer({
  dest: "uploads/productimages/",
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

const router = Router();

// ✅ Get all products (public for all logged-in users)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // ❌ removed userId filter
    res.json(products);
  } catch (err) {
    console.log('err', err);
    res.status(500).json({ message: "Failed to fetch products", error: String(err) });
  }
});

// ✅ Add product (no userId attached)
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const newProduct = new Product({ ...req.body }); // ❌ removed userId
    const saved = await newProduct.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: "Failed to add product", error: String(err) });
  }
});

// ✅ Update product (by product ID only)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }); // ❌ removed userId
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update product", error: String(err) });
  }
});

// ✅ Delete product (by product ID only)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id); // ❌ removed userId
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    // console.log('err', err);
    res.status(400).json({ message: "Failed to delete product", error: String(err) });
  }
});

// ✅ Single file upload
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  // Serve files via static route
  const fileUrl = `http://localhost:3000/uploads/productimages/${req.file.filename}`;

  res.json({
    url: fileUrl,
    name: req.file.originalname,
  });
});

export default router;
