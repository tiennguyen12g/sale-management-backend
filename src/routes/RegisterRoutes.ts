import { Router } from "express";
import User from "../models/User.js";


const router = Router();

/**
 * @route   POST /api/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // simple validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // create new user
    const user = new User({ username, email, password });
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user._id, name: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
