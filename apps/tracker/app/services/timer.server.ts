import { prisma } from "../utils/db.server";
import { getValidAccessToken, createTimesheetEntry, getProjectTimesheetRecordingId } from "../utils/basecamp.server";

export async function getActiveTimer(userId: string) {
  return await prisma.activeTimer.findUnique({
    where: { userId },
  });
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
  updatedDurationSec: number,
  timezone: string
) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, syncStatus: "NEEDS_APPROVAL" },
  });

  if (!entry) throw new Error("Entry not found or already approved");

  const durationHours = updatedDurationSec / 3600;
  let newStatus: "PENDING" | "SYNCED" | "FAILED" = "FAILED";
  let syncError: string | null = null;

  try {
    const accessToken = await getValidAccessToken(userId);
    // en-CA locale formats as YYYY-MM-DD; the date must be in the user's
    // timezone, not the server's, or entries stopped near midnight land on
    // the wrong day in Basecamp.
    let date: string;
    try {
      date = entry.stoppedAt.toLocaleDateString("en-CA", { timeZone: timezone });
    } catch {
      date = entry.stoppedAt.toLocaleDateString("en-CA");
    }
    const payload = {
      date,
      hours: Number(durationHours.toFixed(2)),
      description: entry.source === "BASECAMP" ? "Tracked via BaseTrack" : entry.todoTitle,
    };

    let recordingId: string;

    if (entry.source === "BASECAMP") {
      recordingId = entry.todoId;
    } else {
      const found = await getProjectTimesheetRecordingId(basecampId, entry.projectId, accessToken);
      if (!found) {
        console.warn(
          `[SYNC] Project ${entry.projectId} has no project-level timesheet entries. ` +
          `Log at least one project-level time entry manually in Basecamp to enable auto-sync.`
        );
        syncError = "Project has no timesheet recording in Basecamp. Log a project-level time entry manually first.";
        throw new Error("bootstrap");
      }
      recordingId = found;
    }

    await createTimesheetEntry(basecampId, recordingId, accessToken, payload);
    newStatus = "SYNCED";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg !== "bootstrap") {
      console.error("Failed to sync timesheet entry on approval:", err);
      syncError = errMsg || "Basecamp sync failed";
    }
  }

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      durationSec: updatedDurationSec,
      syncStatus: newStatus,
      syncError,
    },
  });

  return { success: true, status: newStatus };
}
