// server.js
import http from "http";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import { connectDB } from "./config/db.js";
import registeredUser from "./Routes/Register.js";
import LoginUser from "./Routes/Login.js";
import profileRoutes from "./Routes/Profile.js";
import MessageRoute from "./Routes/MessageRoute.js";
import { PeopleRoute } from "./Routes/PeopleRoute.js";
import { setupWebSocket } from "./Socket/SetUpWebSocket.js";

dotenv.config();

const app = express();
const server = http.createServer(app); // <-- use this server for both HTTP & WS

const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mern_chat";

// ----- Ensure uploads directory exists (used by WS file uploads) -----
const uploadsDir = path.join(process.cwd(), "uploads");
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("[server] ensured uploads dir exists at", uploadsDir);
} catch (e) {
  console.error("[server] failed to create uploads dir:", e);
}

// Expose uploads/ as static so files can be served at /uploads/<filename>
// IMPORTANT: In production, consider protecting this route (require auth) or
// serving files from a private store (S3) and generate signed URLs.
app.use("/uploads", express.static(uploadsDir));

// ----- Middleware (order matters) -----
const allowedOrigins = [
  "http://localhost:5173",                 // local dev
  "https://your-frontend.onrender.com",   // will update after frontend deploy
];
app.use(cors({ origin: allowedOrigins,
    credentials: true, }));
app.use(express.json());
app.use(cookieParser());

export async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, {}, (err, userData) => {
        if (err) return reject(err);
        resolve(userData);
      });
    } else {
      reject("no token");
    }
  });
}

// ----- Routes -----
app.get("/test", (_req, res) => res.json("Ok, Api is working correctly"));

app.get("/messages/:userId", MessageRoute);
app.get("/people", PeopleRoute);
app.post("/login", LoginUser);
app.post("/register", registeredUser);
app.use("/profile", profileRoutes);
app.post("/logout", (req, res) => {
  // clear cookie (adjust domain/sameSite/secure for your deployment)
  res.clearCookie("token", { sameSite: "none", secure: true }).json("ok");
});

// ----- Error handler (last) -----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

// ----- WebSocket server attached to the SAME HTTP server -----
setupWebSocket(server, { requireAuth: true });

// ----- Start AFTER DB connects; IMPORTANT: server.listen (not app.listen) -----
connectDB(MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`API + WS running on ${PORT}`));
});
