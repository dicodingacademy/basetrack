import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

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

function evaluateCondition(condition, elapsedHours, nowInUserTz) {
  const { type, operator, value } = condition;

  switch (type) {
    case "elapsed_hours": {
      if (operator === "gte") return elapsedHours >= value;
      break;
    }

    case "time_of_day": {
      const currentHour = nowInUserTz.hour;
      const currentMinute = nowInUserTz.minute;
      const currentMinutes = currentHour * 60 + currentMinute;

      if (operator === "gte") {
        const [h, m] = value.split(":").map(Number);
        return currentMinutes >= h * 60 + m;
      }
      if (operator === "lte") {
        const [h, m] = value.split(":").map(Number);
        return currentMinutes <= h * 60 + m;
      }
      if (operator === "between") {
        const [fromStr, toStr] = value;
        const [fromH, fromM] = fromStr.split(":").map(Number);
        const [toH, toM] = toStr.split(":").map(Number);
        const fromMinutes = fromH * 60 + fromM;
        const toMinutes = toH * 60 + toM;

        if (fromMinutes <= toMinutes) {
          return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
        }
        // overnight range
        return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
      }
      break;
    }

    case "day_of_week": {
      if (operator === "in") {
        return value.includes(nowInUserTz.weekday % 7); // Luxon: 1=Mon..7=Sun → 0=Sun..6=Sat
      }
      break;
    }
  }

  return false;
}

console.log(`Cron service starting [${new Date().toISOString()}]`);

cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running auto-stop check...`);
  try {
    const activeTimers = await prisma.activeTimer.findMany({
      include: {
        user: {
          include: {
            rules: {
              where: { enabled: true },
            },
          },
        },
      },
    });

    const now = new Date();

    for (const timer of activeTimers) {
      const { user } = timer;
      const rules = user.rules;

      if (rules.length === 0) continue;

      const nowInUserTz = DateTime.now().setZone(user.timezone || "Asia/Jakarta");
      const elapsedMs = now.getTime() - timer.startedAt.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      let shouldStop = false;
      let matchedRule = null;

      for (const rule of rules) {
        const conditions = rule.conditions;
        if (!Array.isArray(conditions) || conditions.length === 0) continue;

        const allMatch = conditions.every((c) =>
          evaluateCondition(c, elapsedHours, nowInUserTz)
        );

        if (allMatch) {
          shouldStop = true;
          matchedRule = rule;
          break;
        }
      }

      if (shouldStop) {
        console.log(
          `Stopping timer for user ${timer.userId} (matched rule "${matchedRule.name || matchedRule.id}"). Elapsed: ${elapsedHours.toFixed(2)}h`
        );

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

process.on("SIGINT", async () => {
  console.log("Shutting down cron service...");
  await prisma.$disconnect();
  process.exit(0);
});
