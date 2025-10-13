import { Router } from "express";
import MoneyBankAccount from "../models/MoneyBankAccount.js";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
const router = Router();


// ✅ Get all accounts for logged-in user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const accounts = await MoneyBankAccount.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.json(accounts);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch accounts", error: String(err) });
  }
});

// ✅ Add new account
router.post("/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const account = new MoneyBankAccount({
      ...req.body,
      userId: req.userId, // 🔑 tie to user
    });
    const saved = await account.save();
    res.status(201).json(saved);
  } catch (err) {
    console.log("err", err);
    res
      .status(400)
      .json({ message: "Failed to add account", error: String(err) });
  }
});

// ✅ Update account (only if belongs to user)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updated = await MoneyBankAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, // ownership check
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json(updated);
  } catch (err) {
    res
      .status(400)
      .json({ message: "Failed to update account", error: String(err) });
  }
});

// ✅ Delete account (only if belongs to user)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const deleted = await MoneyBankAccount.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!deleted) return res.status(404).json({ message: "Account not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Failed to delete account", error: String(err) });
  }
});

export default router;
