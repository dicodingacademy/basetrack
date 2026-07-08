import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  getValidAccessToken,
  createTimesheetEntry,
  getProjectTimesheetRecordingId,
} from "./basecamp.js";

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const expectedInternalKey = process.env.INTERNAL_API_KEY;
if (process.env.NODE_ENV === "production" && !expectedInternalKey) {
  throw new Error("INTERNAL_API_KEY must be set in production environment");
}
const INTERNAL_KEY = expectedInternalKey || "dev-internal-key-123";

function isAuthorized(providedKey?: string | string[]): boolean {
  if (typeof providedKey !== "string") return false;
  if (providedKey.length !== INTERNAL_KEY.length) return false;
  return timingSafeEqual(Buffer.from(providedKey), Buffer.from(INTERNAL_KEY));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

const activeClients = new Map<WebSocket, string>();

function broadcastToUser(userId: string, event: object) {
  for (const [ws, uid] of activeClients) {
    if (uid === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}

wss.on("connection", (ws) => {
  let isAuthenticated = false;

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "AUTH") {
        const apiKey = message.apiKey;
        if (!apiKey || typeof apiKey !== "string") {
          ws.send(JSON.stringify({ type: "ERROR", message: "API Key required and must be a string" }));
          setTimeout(() => ws.close(1008, "API Key required"), 50);
          return;
        }

        const user = await prisma.user.findUnique({ where: { apiKey } });

        if (!user) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid API Key" }));
          setTimeout(() => ws.close(1008, "Invalid API Key"), 50);
          return;
        }

        isAuthenticated = true;
        activeClients.set(ws, user.id);
        ws.send(JSON.stringify({ type: "AUTH_SUCCESS", message: "Authenticated successfully" }));
        console.log(`WebSocket authenticated for user ${user.id}`);

        const activeTimer = await prisma.activeTimer.findUnique({ where: { userId: user.id } });
        if (activeTimer) {
          ws.send(JSON.stringify({ type: "TIMER_STARTED", timer: activeTimer, isInitialSync: true }));
        } else {
          ws.send(JSON.stringify({ type: "TIMER_STOPPED", isInitialSync: true }));
        }

      } else if (message.type === "START_TIMER") {
        if (!isAuthenticated) return;
        const userId = activeClients.get(ws);
        if (!userId) return;

        const { todoId, todoTitle, projectId, projectName, source } = message;

        if (!todoId || !todoTitle || !projectId || !projectName) {
          ws.send(JSON.stringify({ type: "TIMER_ERROR", code: "INVALID_DATA", message: "Missing required fields" }));
          return;
        }

        try {
          await prisma.activeTimer.deleteMany({ where: { userId } });
          const newTimer = await prisma.activeTimer.create({
            data: {
              userId,
              todoId,
              todoTitle,
              projectId,
              projectName,
              source: source || "BASECAMP",
            },
          });
          broadcastToUser(userId, { type: "TIMER_STARTED", timer: newTimer });
          console.log(`Timer started for user ${userId}: ${todoTitle}`);
        } catch (err) {
          console.error("Failed to start timer:", err);
          ws.send(JSON.stringify({ type: "TIMER_ERROR", code: "START_FAILED", message: "Failed to start timer" }));
        }

      } else if (message.type === "STOP_TIMER") {
        if (!isAuthenticated) return;
        const userId = activeClients.get(ws);
        if (!userId) return;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const activeTimer = await prisma.activeTimer.findUnique({ where: { userId } });

        if (!activeTimer) {
          ws.send(JSON.stringify({ type: "TIMER_STOPPED" }));
          return;
        }

        const stoppedAt = new Date();
        const durationSec = Math.floor((stoppedAt.getTime() - activeTimer.startedAt.getTime()) / 1000);
        const durationHours = durationSec / 3600;

        await prisma.activeTimer.delete({ where: { userId } });

        // Broadcast immediately — UI doesn't wait for Basecamp sync
        broadcastToUser(userId, { type: "TIMER_STOPPED" });
        console.log(`Timer stopped for user ${userId}, duration: ${durationSec}s`);

        let syncStatus: "SYNCED" | "FAILED" | "NEEDS_APPROVAL" = "FAILED";
        let syncError: string | null = null;

        if (durationSec < 60) {
          syncError = "Duration too short (minimum 60 s for Basecamp)";
        } else {
          try {
            const accessToken = await getValidAccessToken(userId, prisma);
            const yyyy = stoppedAt.getFullYear();
            const mm = String(stoppedAt.getMonth() + 1).padStart(2, "0");
            const dd = String(stoppedAt.getDate()).padStart(2, "0");
            const payload = {
              date: `${yyyy}-${mm}-${dd}`,
              hours: Number(durationHours.toFixed(2)),
              description: activeTimer.source === "BASECAMP" ? "Tracked via BaseTrack" : activeTimer.todoTitle,
            };

            let recordingId: string;

            if (activeTimer.source === "BASECAMP") {
              recordingId = activeTimer.todoId;
            } else {
              const found = await getProjectTimesheetRecordingId(
                user.basecampAccountId,
                activeTimer.projectId,
                accessToken
              );
              if (!found) {
                console.warn(
                  `[SYNC] Project ${activeTimer.projectId} has no project-level timesheet entries. ` +
                  `Log at least one project-level time entry manually in Basecamp to enable auto-sync.`
                );
                syncError = "Project has no timesheet recording in Basecamp. Log a project-level time entry manually first.";
                throw new Error("bootstrap");
              }
              recordingId = found;
            }

            await createTimesheetEntry(user.basecampAccountId, recordingId, accessToken, payload);
            syncStatus = "SYNCED";
          } catch (err: any) {
            if (err?.message !== "bootstrap") {
              console.error("Failed to sync timesheet entry:", err);
              syncError = (err as Error).message || "Basecamp sync failed";
            }
          }
        }

        await prisma.timeEntry.create({
          data: {
            userId,
            todoId: activeTimer.todoId,
            todoTitle: activeTimer.todoTitle,
            projectId: activeTimer.projectId,
            projectName: activeTimer.projectName,
            startedAt: activeTimer.startedAt,
            stoppedAt,
            durationSec,
            stopReason: "MANUAL",
            syncStatus,
            syncError,
            source: activeTimer.source,
          },
        });
      }
    } catch (e) {
      console.error("WebSocket message error:", e);
    }
  });

  ws.on("close", () => {
    activeClients.delete(ws);
  });

  setTimeout(() => {
    if (!isAuthenticated && ws.readyState === WebSocket.OPEN) {
      ws.close(1008, "Authentication timeout");
    }
  }, 15000);
});

app.post("/internal/broadcast", (req, res) => {
  const internalKey = req.headers["x-internal-key"];

  if (!isAuthorized(internalKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, event } = req.body;

  if (!userId || !event) {
    res.status(400).json({ error: "Missing userId or event" });
    return;
  }

  let sentCount = 0;
  for (const [ws, connectedUserId] of activeClients.entries()) {
    if (connectedUserId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      sentCount++;
    }
  }

  res.json({ success: true, sentCount });
});

app.post("/internal/kick", (req, res) => {
  const internalKey = req.headers["x-internal-key"];

  if (!isAuthorized(internalKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  let kickedCount = 0;
  for (const [ws, connectedUserId] of activeClients.entries()) {
    if (connectedUserId === userId) {
      ws.close(1008, "Session invalidated by server");
      activeClients.delete(ws);
      kickedCount++;
    }
  }

  res.json({ success: true, kickedCount });
});

const PORT = process.env.PORT || 8081;
server.listen(Number(PORT), () => {
  console.log(`WebSocket server running on port ${PORT} [${new Date().toISOString()}]`);
});
