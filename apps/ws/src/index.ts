import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { createServer } from "node:http";

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const activeClients = new Map<WebSocket, string>(); // ws -> userId

// Task 9.2: WebSocket Authentication
wss.on("connection", (ws) => {
  let isAuthenticated = false;

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === "AUTH") {
        const apiKey = message.apiKey;
        if (!apiKey) {
          ws.send(JSON.stringify({ type: "ERROR", message: "API Key required" }));
          setTimeout(() => ws.close(1008, "API Key required"), 50);
          return;
        }

        const user = await prisma.user.findUnique({
          where: { desktopApiKey: apiKey }
        });

        if (!user) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid API Key" }));
          setTimeout(() => ws.close(1008, "Invalid API Key"), 50);
          return;
        }

        isAuthenticated = true;
        activeClients.set(ws, user.id);
        ws.send(JSON.stringify({ type: "AUTH_SUCCESS", message: "Authenticated successfully" }));
        console.log(`WebSocket authenticated for user ${user.id}`);

        // Fetch current active timer state to sync on launch
        const activeTimer = await prisma.activeTimer.findUnique({
          where: { userId: user.id }
        });
        
        if (activeTimer) {
          ws.send(JSON.stringify({ type: "TIMER_STARTED", timer: activeTimer, isInitialSync: true }));
        } else {
          ws.send(JSON.stringify({ type: "TIMER_STOPPED", isInitialSync: true }));
        }
      } else if (message.type === "STOP_TIMER") {
        if (!isAuthenticated) return;
        const user = await prisma.user.findUnique({
          where: { desktopApiKey: message.apiKey }
        });
        if (!user) return;

        const activeTimer = await prisma.activeTimer.findUnique({
          where: { userId: user.id }
        });

        if (activeTimer) {
          const trackerUrl = process.env.TRACKER_INTERNAL_URL || "http://localhost:5173/api/internal/stop";
          const internalKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";

          try {
            await fetch(trackerUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-key": internalKey,
              },
              body: JSON.stringify({ userId: user.id, basecampId: user.basecampId }),
            });
          } catch (err) {
            console.error("Failed to call internal stop API:", err);
          }
        }
      }
    } catch (e) {
      console.error("WebSocket message error:", e);
    }
  });

  ws.on("close", () => {
    activeClients.delete(ws);
  });

  // Timeout if not authenticated within 15 seconds
  setTimeout(() => {
    if (!isAuthenticated && ws.readyState === WebSocket.OPEN) {
      ws.close(1008, "Authentication timeout");
    }
  }, 15000);
});

// Internal endpoint to trigger broadcasts from tracker or cron
app.post("/internal/broadcast", (req, res) => {
  // Simple internal security
  const internalKey = req.headers["x-internal-key"];
  const expectedKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";
  
  if (internalKey !== expectedKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, event } = req.body;
  
  if (!userId || !event) {
    res.status(400).json({ error: "Missing userId or event" });
    return;
  }

  // Broadcast to this user's connections
  let sentCount = 0;
  for (const [ws, connectedUserId] of activeClients.entries()) {
    if (connectedUserId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      sentCount++;
    }
  }

  res.json({ success: true, sentCount });
});

const PORT = process.env.PORT || 8081;
server.listen(Number(PORT), () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
