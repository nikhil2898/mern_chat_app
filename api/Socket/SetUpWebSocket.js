// api/Socket/SetUpWebSocket.js  (modified)
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import Message from "../models/Message.model.js";
import fs from "fs";
import path from "path";

export function setupWebSocket(server, { requireAuth = true } = {}) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (connection, req) => {
    try {
      const rawCookies = req.headers.cookie || "";
      console.log("[WS] new connection - cookies:", rawCookies);

      const token = rawCookies
        .split(";")
        .map((s) => s.trim())
        .find((str) => str.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        console.warn("[WS] no token found in cookies for connection");
        if (requireAuth) {
          try {
            connection.close(4002, "Missing token");
          } catch {}
          return;
        } else {
          connection.isAuthenticated = false;
        }
      } else {
        let userData;
        try {
          userData = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          console.error("[WS] jwt verify failed:", err && err.message);
          try {
            connection.close(4001, "Invalid token");
          } catch {}
          return;
        }

        const userId = userData?.userId ?? userData?.id ?? userData?._id;
        const username =
          userData?.username ?? userData?.name ?? userData?.email;

        if (!userId) {
          console.warn("[WS] token payload missing user id field:", userData);
          if (requireAuth) {
            try {
              connection.close(4003, "Invalid token payload");
            } catch {}
            return;
          } else {
            connection.isAuthenticated = false;
          }
        } else {
          connection.userId = String(userId);
          connection.username = username || "Unknown";
          connection.isAuthenticated = true;
          connection.lastSeen = Date.now();
          console.log("[WS] connection authenticated:", {
            userId: connection.userId,
            username: connection.username,
          });
        }
      }

      // notify current clients about online list
      broadcastOnline(wss);

      connection.on("message", async (message) => {
        try {
          const parsed = JSON.parse(message.toString());

          // control messages
          const ctrlType = parsed?.type;
          if (ctrlType === "heartbeat") {
            connection.lastSeen = Date.now();
            return;
          }
          if (ctrlType === "deactivate") {
            try {
              connection.close(1000, "Client deactivated");
            } catch (e) {}
            broadcastOnline(wss);
            return;
          }

          // ---------- FILE handling ----------
          // FILE handling
          if (parsed?.type === "file") {
            const { recipient, filename, contentType, size, data } = parsed;
            if (!recipient || !filename || !data) {
              console.warn("[WS] file message missing fields", parsed);
              return;
            }

            const uploadDir = path.join(process.cwd(), "uploads");
            try {
              fs.mkdirSync(uploadDir, { recursive: true });
            } catch (e) {
              console.error("[WS] failed to create uploads dir", e);
            }

            const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
            const savedName = `${Date.now()}-${connection.userId}-${safeName}`;
            const savedPath = path.join(uploadDir, savedName);

            const base64 = String(data).includes(",")
              ? String(data).split(",")[1]
              : data;

            try {
              const fileBuffer = Buffer.from(base64, "base64");
              fs.writeFileSync(savedPath, fileBuffer);
            } catch (e) {
              console.error("[WS] failed to write uploaded file", e);
              return;
            }

            const fileUrl = `/uploads/${savedName}`;

            let messageDoc = null;
            try {
              messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                message: "",
                file: {
                  filename,
                  url: fileUrl,
                  contentType: contentType || "application/octet-stream",
                  size: typeof size === "number" ? size : undefined,
                },
              });
            } catch (dbErr) {
              console.error(
                "[WS] failed to create message doc with file:",
                dbErr
              );
            }

            const wsPayload = {
              type: "file",
              sender: connection.userId,
              recipient,
              file: {
                filename,
                url: fileUrl,
                contentType: contentType || "application/octet-stream",
                size: typeof size === "number" ? size : undefined,
              },
              id: messageDoc ? messageDoc._id : null,
            };

            const recId = String(recipient);
            const senderId = String(connection.userId);

            // send to sender + recipient
            [...wss.clients]
              .filter(
                (c) =>
                  c &&
                  c.readyState === WebSocket.OPEN &&
                  (String(c.userId) === recId || String(c.userId) === senderId)
              )
              .forEach((c) => {
                try {
                  c.send(JSON.stringify(wsPayload));
                } catch (err) {
                  console.error("[WS] failed to send file to client:", err);
                }
              });

            return;
          }

          // ---------- TEXT MESSAGE handling ----------
          const payload = parsed.message ?? parsed;
          const { recipient, text } = payload ?? {};

          if (recipient && text) {
            const messageDoc = await Message.create({
              sender: connection.userId,
              recipient,
              message: text,
            });

            const wsPayload = {
              type: "message",
              sender: connection.userId,
              recipient,
              text,
              id: messageDoc._id,
            };

            const recId = String(recipient);
            const senderId = String(connection.userId);

            // ✅ send only to sender + recipient (NOT to everyone)
            [...wss.clients]
              .filter(
                (c) =>
                  c &&
                  c.readyState === WebSocket.OPEN &&
                  (String(c.userId) === recId || String(c.userId) === senderId)
              )
              .forEach((c) => {
                try {
                  c.send(JSON.stringify(wsPayload));
                } catch (err) {
                  console.error("[WS] failed to send to client:", err);
                }
              });
          } else {
            console.log(
              "[WS] message missing recipient/text; received:",
              parsed
            );
          }
        } catch (err) {
          console.error("[WS] invalid JSON from client:", err);
        }
      });

      connection.on("close", (code, reason) => {
        console.log(
          "[WS] connection closed:",
          connection.userId ?? "no-id",
          code,
          reason
        );
        broadcastOnline(wss);
      });

      connection.on("error", (err) => {
        console.error("[WS] connection error:", err);
      });
    } catch (e) {
      console.error("[WS] connection handler error:", e);
      try {
        connection.close(1011, "Server error");
      } catch {}
    }
  });

  function broadcastOnline(wssInstance) {
    const online = [...wssInstance.clients]
      .filter((c) => c && c.isAuthenticated && c.userId)
      .map((c) => ({ userId: c.userId, username: c.username }));

    console.log("[WS] broadcasting online:", online);

    for (const client of wssInstance.clients) {
      try {
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ online }));
        }
      } catch (e) {
        console.error("[WS] send failed to client:", e);
      }
    }
  }

  console.log("WebSocket server running...");

  // Periodic sweep to detect stale connections (no heartbeat)
  const HEARTBEAT_TIMEOUT = 15_000; // 15 seconds
  setInterval(() => {
    const now = Date.now();
    for (const client of wss.clients) {
      try {
        if (!client || client.readyState !== WebSocket.OPEN) continue;
        if (
          client.isAuthenticated &&
          client.lastSeen &&
          now - client.lastSeen > HEARTBEAT_TIMEOUT
        ) {
          console.log(
            "[WS] terminating stale connection for user",
            client.userId
          );
          try {
            client.terminate();
          } catch (e) {
            try {
              client.close();
            } catch {}
          }
        }
      } catch (e) {
        console.error("[WS] error during heartbeat sweep", e);
      }
    }
  }, 5000);
}
