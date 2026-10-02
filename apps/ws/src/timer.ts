import type { ActiveTimer, PrismaClient } from "@prisma/client";
import {
  getValidAccessToken,
  createTimesheetEntry,
  getProjectTimesheetRecordingId,
} from "./basecamp.js";

export type StartTimerInput = {
  todoId: string;
  todoTitle: string;
  projectId: string;
  projectName: string;
  source?: string;
};

type Broadcast = (userId: string, event: object) => void;

/** YYYY-MM-DD in the user's timezone; the server's own timezone (UTC in Docker) would shift late-night entries to the wrong day. */
function formatDateInTimezone(date: Date, timezone: string) {
  try {
    return date.toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return date.toLocaleDateString("en-CA");
  }
}

export function createTimerService(prisma: PrismaClient, broadcastToUser: Broadcast) {
  /**
   * Removes the user's running timer and records it as a TimeEntry. The delete is
   * keyed on the timer's id so that concurrent stops (web + desktop + extension)
   * can't record the same timer twice — only the caller whose delete succeeds wins.
   */
  async function claimRunningTimer(userId: string): Promise<{ timer: ActiveTimer; stoppedAt: Date } | null> {
    const timer = await prisma.activeTimer.findUnique({ where: { userId } });
    if (!timer) return null;

    const claimed = await prisma.activeTimer.deleteMany({ where: { id: timer.id } });
    if (claimed.count === 0) return null;

    return { timer, stoppedAt: new Date() };
  }

  async function recordAndSync(timer: ActiveTimer, stoppedAt: Date) {
    const durationSec = Math.floor((stoppedAt.getTime() - timer.startedAt.getTime()) / 1000);

    // Persist first so the entry survives a crash or a slow Basecamp call.
    const entry = await prisma.timeEntry.create({
      data: {
        userId: timer.userId,
        todoId: timer.todoId,
        todoTitle: timer.todoTitle,
        projectId: timer.projectId,
        projectName: timer.projectName,
        startedAt: timer.startedAt,
        stoppedAt,
        durationSec,
        stopReason: "MANUAL",
        syncStatus: "PENDING",
        source: timer.source,
      },
    });

    let syncStatus: "SYNCED" | "FAILED" = "FAILED";
    let syncError: string | null = null;

    if (durationSec < 60) {
      syncError = "Duration too short (minimum 60 s for Basecamp)";
    } else {
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: timer.userId } });
        const accessToken = await getValidAccessToken(user.id, prisma);
        const payload = {
          date: formatDateInTimezone(stoppedAt, user.timezone),
          hours: Number((durationSec / 3600).toFixed(2)),
          description: timer.source === "BASECAMP" ? "Tracked via BaseTrack" : timer.todoTitle,
        };

        let recordingId: string;

        if (timer.source === "BASECAMP") {
          recordingId = timer.todoId;
        } else {
          const found = await getProjectTimesheetRecordingId(user.basecampAccountId, timer.projectId, accessToken);
          if (!found) {
            console.warn(
              `[SYNC] Project ${timer.projectId} has no project-level timesheet entries. ` +
              `Log at least one project-level time entry manually in Basecamp to enable auto-sync.`
            );
            syncError = "Project has no timesheet recording in Basecamp. Log a project-level time entry manually first.";
            throw new Error("bootstrap");
          }
          recordingId = found;
        }

        await createTimesheetEntry(user.basecampAccountId, recordingId, accessToken, payload);
        syncStatus = "SYNCED";
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg !== "bootstrap") {
          console.error("Failed to sync timesheet entry:", err);
          syncError = errMsg || "Basecamp sync failed";
        }
      }
    }

    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { syncStatus, syncError },
    });
  }

  function recordInBackground(timer: ActiveTimer, stoppedAt: Date) {
    recordAndSync(timer, stoppedAt).catch((err) => {
      console.error(`Failed to record stopped timer ${timer.id}:`, err);
    });
  }

  /**
   * Starts a timer. A timer that is already running is stopped and recorded first
   * (auto-switch), so switching tasks never discards tracked time.
   */
  async function startTimer(userId: string, input: StartTimerInput) {
    const previous = await claimRunningTimer(userId);

    const timer = await prisma.activeTimer.create({
      data: {
        userId,
        todoId: input.todoId,
        todoTitle: input.todoTitle,
        projectId: input.projectId,
        projectName: input.projectName,
        source: input.source || "BASECAMP",
      },
    });

    broadcastToUser(userId, { type: "TIMER_STARTED", timer });
    console.log(`Timer started for user ${userId}: ${input.todoTitle}`);

    if (previous) {
      recordInBackground(previous.timer, previous.stoppedAt);
      return {
        timer,
        switchedFrom: {
          todoTitle: previous.timer.todoTitle,
          durationSec: Math.floor((previous.stoppedAt.getTime() - previous.timer.startedAt.getTime()) / 1000),
        },
      };
    }

    return { timer, switchedFrom: null };
  }

  async function stopTimer(userId: string) {
    const claimed = await claimRunningTimer(userId);

    // Broadcast immediately — UI doesn't wait for Basecamp sync
    broadcastToUser(userId, { type: "TIMER_STOPPED" });
    if (!claimed) return { stopped: false };

    const durationSec = Math.floor((claimed.stoppedAt.getTime() - claimed.timer.startedAt.getTime()) / 1000);
    console.log(`Timer stopped for user ${userId}, duration: ${durationSec}s`);

    recordInBackground(claimed.timer, claimed.stoppedAt);
    return { stopped: true };
  }

  return { startTimer, stopTimer };
}
