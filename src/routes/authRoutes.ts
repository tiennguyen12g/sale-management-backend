import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // keep in .env

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, staffRole, isCreateProfile, registeredDate } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const user = new User({ username, email, password, staffRole, isCreateProfile, registeredDate });
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        staffRole: user.staffRole, 
        isCreateProfile: user.isCreateProfile,
        registeredDate: user.registeredDate,
       },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ include staffRole, username, email in token payload
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        staffRole: user.staffRole,
        isCreateProfile: user.isCreateProfile,
        registeredDate: user.registeredDate,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        staffRole: user.staffRole,
        isCreateProfile: user.isCreateProfile,
        registeredDate: user.registeredDate,
      },
    });
  } catch (err) {
    console.log('err', err);
    res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// Change password
router.put("/change-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({ message: "Old password is incorrect" });

    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: String(err) });
  }
});

// Update role or isCreateProfile
router.put("/update-role", async (req, res) => {
  try {
    const { userId, staffRole, isCreateProfile } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (staffRole) user.staffRole = staffRole;
    if (typeof isCreateProfile === "boolean") user.isCreateProfile = isCreateProfile;

    await user.save();

    res.json({
      message: "Account updated successfully",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        staffRole: user.staffRole,
        isCreateProfile: user.isCreateProfile,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: String(err) });
  }
});

export default router;
