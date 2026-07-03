import { prisma } from "../utils/db.server";
import { getValidAccessToken, createTimesheetEntry } from "../utils/basecamp.server";

export async function getActiveTimer(userId: string) {
  return await prisma.activeTimer.findUnique({
    where: { userId },
  });
}

export async function startTimer(
  userId: string,
  data: { todoId: string; todoTitle: string; projectId: string; projectName: string }
) {
  await prisma.activeTimer.deleteMany({ where: { userId } });

  await prisma.activeTimer.create({
    data: {
      userId,
      ...data,
    },
  });

  return { success: true };
}

export async function stopTimer(userId: string, basecampId: string) {
  const activeTimer = await prisma.activeTimer.findUnique({ where: { userId } });
  if (!activeTimer) return { success: true }; // already stopped

  const stoppedAt = new Date();
  const durationSec = Math.floor((stoppedAt.getTime() - activeTimer.startedAt.getTime()) / 1000);
  const durationHours = durationSec / 3600;

  let syncStatus: "PENDING" | "SYNCED" | "FAILED";

  // Sync directly to basecamp if time is meaningful (> 1 minute)
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
    syncStatus = "FAILED"; // Too short to sync
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
    },
  });

  await prisma.activeTimer.delete({ where: { userId } });
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
