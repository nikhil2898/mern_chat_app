import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import User from "../models/User.model.js";

const router = express.Router();

// GET /profile
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("username _id");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.set("Cache-Control", "no-store");
     res.json({ id: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch User" });
  }
});

export default router;
