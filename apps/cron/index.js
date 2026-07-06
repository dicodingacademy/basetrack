import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function notifyWebSocketServer(userId, event) {
  try {
    const wsUrl = process.env.WS_INTERNAL_URL || "http://localhost:8081/internal/broadcast";
    const internalKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";
    
    await fetch(wsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({ userId, event }),
    });
  } catch (e) {
    console.error("Failed to notify WS server:", e.message);
  }
}

console.log("Cron service starting...");

// Run every minute
cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running auto-stop check...`);
  try {
    const activeTimers = await prisma.activeTimer.findMany({
      include: {
        user: true,
      },
    });

    const now = new Date();

    for (const timer of activeTimers) {
      const thresholdHours = timer.user.autoStopThresholdHours;
      const elapsedMs = now.getTime() - timer.startedAt.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= thresholdHours) {
        console.log(`Stopping timer for user ${timer.userId} (exceeded ${thresholdHours}h limit). Elapsed: ${elapsedHours.toFixed(2)}h`);
        
        await prisma.$transaction([
          prisma.timeEntry.create({
            data: {
              userId: timer.userId,
              todoId: timer.todoId,
              todoTitle: timer.todoTitle,
              projectId: timer.projectId,
              projectName: timer.projectName,
              startedAt: timer.startedAt,
              stoppedAt: now,
              durationSec: Math.floor(elapsedMs / 1000),
              stopReason: "AUTO_STOPPED",
              syncStatus: "NEEDS_APPROVAL",
              source: timer.source,
            },
          }),
          prisma.activeTimer.delete({
            where: { id: timer.id },
          }),
        ]);
        
        await notifyWebSocketServer(timer.userId, { type: "TIMER_AUTO_STOPPED" });
      }
    }
  } catch (error) {
    console.error("Error during auto-stop check:", error);
  }
});

// Keep process alive
process.on("SIGINT", async () => {
  console.log("Shutting down cron service...");
  await prisma.$disconnect();
  process.exit(0);
});
