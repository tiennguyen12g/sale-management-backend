import { Router } from "express";
import User from "../models/User.js"

const router = Router();

router.post("/", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

export default router;
