import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";

export default async function Login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const foundUser = await User.findOne({ username });
    if (!foundUser)
      return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, foundUser.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: foundUser._id, username: foundUser.username },
      process.env.JWT_SECRET || process.env.jwt_salt || "dev-secret",
      { expiresIn: "7d" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ id: foundUser._id, username: foundUser.username });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
