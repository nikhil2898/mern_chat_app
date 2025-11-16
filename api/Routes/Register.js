import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";


export default async function registeredUser(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }
  try {
    const exists = await User.findOne({ username });
    if (exists)
      return res.status(409).json({ error: "Username already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: passwordHash });

    const token = jwt.sign(
      { id: user._id, username: user.username },
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
      .status(201)
      .json({ id: user._id, username: user.username });
  } catch (err) {
    console.error("REGISTER_ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
