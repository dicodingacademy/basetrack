import { prisma } from "../utils/db.server";
import { getValidAccessToken, createTimesheetEntry } from "../utils/basecamp.server";

export async function notifyWebSocketServer(userId: string, event: any) {
  try {
    const wsUrl = process.env.WS_INTERNAL_URL || "http://localhost:8081/internal/broadcast";
    const internalKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";
    
    fetch(wsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({ userId, event }),
    }).catch((e) => console.error("Failed to notify WS server (async):", e.message));
  } catch (e: any) {
    console.error("Failed to notify WS server:", e.message);
  }
}

export async function getActiveTimer(userId: string) {
  return await prisma.activeTimer.findUnique({
    where: { userId },
  });
}

export async function startTimer(
  userId: string,
  data: { todoId: string; todoTitle: string; projectId: string; projectName: string; source?: string }
) {
  await prisma.activeTimer.deleteMany({ where: { userId } });

  const newTimer = await prisma.activeTimer.create({
    data: {
      userId,
      ...data,
      source: data.source || "BASECAMP",
    },
  });

  await notifyWebSocketServer(userId, { type: "TIMER_STARTED", timer: newTimer });

  return { success: true };
}

export async function stopTimer(userId: string, basecampId: string) {
  const activeTimer = await prisma.activeTimer.findUnique({ where: { userId } });
  if (!activeTimer) return { success: true };

  const stoppedAt = new Date();
  const durationSec = Math.floor((stoppedAt.getTime() - activeTimer.startedAt.getTime()) / 1000);
  const durationHours = durationSec / 3600;

  await prisma.activeTimer.delete({ where: { userId } });
  await notifyWebSocketServer(userId, { type: "TIMER_STOPPED" });

  let syncStatus: "PENDING" | "SYNCED" | "FAILED";

  if (durationSec >= 60) {
    try {
      const accessToken = await getValidAccessToken(userId);
      const yyyy = stoppedAt.getFullYear();
      const mm = String(stoppedAt.getMonth() + 1).padStart(2, "0");
      const dd = String(stoppedAt.getDate()).padStart(2, "0");

      await createTimesheetEntry(basecampId, activeTimer.todoId, accessToken, {
        date: `${yyyy}-${mm}-${dd}`,
        hours: Number(durationHours.toFixed(2)),
        description: "Tracked via BaseTrack",
      });
      syncStatus = "SYNCED";
    } catch (err) {
      console.error("Failed to sync timesheet entry:", err);
      syncStatus = "FAILED";
    }
  } else {
    syncStatus = "FAILED";
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
      source: activeTimer.source,
    },
  });

  return { success: true };
}

export async function getPendingApprovals(userId: string) {
  return await prisma.timeEntry.findMany({
    where: {
      userId,
      syncStatus: "NEEDS_APPROVAL",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function approveTimeEntry(
  userId: string,
  entryId: string,
  basecampId: string,
  updatedDurationSec: number
) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, syncStatus: "NEEDS_APPROVAL" },
  });

  if (!entry) throw new Error("Entry not found or already approved");

  const durationHours = updatedDurationSec / 3600;
  let newStatus: "PENDING" | "SYNCED" | "FAILED";

  try {
    const accessToken = await getValidAccessToken(userId);
    const stoppedAt = entry.stoppedAt;
    const yyyy = stoppedAt.getFullYear();
    const mm = String(stoppedAt.getMonth() + 1).padStart(2, "0");
    const dd = String(stoppedAt.getDate()).padStart(2, "0");

    await createTimesheetEntry(basecampId, entry.todoId, accessToken, {
      date: `${yyyy}-${mm}-${dd}`,
      hours: Number(durationHours.toFixed(2)),
      description: "Tracked via BaseTrack",
    });
    newStatus = "SYNCED";
  } catch (err) {
    console.error("Failed to sync timesheet entry on approval:", err);
    newStatus = "FAILED";
  }

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      durationSec: updatedDurationSec,
      syncStatus: newStatus,
    },
  });

  return { success: true, status: newStatus };
}
