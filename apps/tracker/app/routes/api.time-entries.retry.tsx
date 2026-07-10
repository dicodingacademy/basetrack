import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { prisma } from "../utils/db.server";
import { getValidAccessToken, createTimesheetEntry, getProjectTimesheetRecordingId } from "../utils/basecamp.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ success: false, syncError: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const entryId = formData.get("entryId") as string;
  if (!entryId) return data({ success: false, syncError: "Missing entryId" }, { status: 400 });

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId: user.id, syncStatus: "FAILED" },
  });

  if (!entry) return data({ success: false, syncError: "Entry not found or not retryable" }, { status: 404 });

  if (entry.durationSec < 60) {
    return data({ success: false, syncError: "Duration too short (minimum 60 s for Basecamp)" }, { status: 422 });
  }

  let syncStatus: "SYNCED" | "FAILED" = "FAILED";
  let syncError: string | null = null;

  try {
    const accessToken = await getValidAccessToken(user.id);
    const stoppedAt = entry.stoppedAt;
    const yyyy = stoppedAt.getFullYear();
    const mm = String(stoppedAt.getMonth() + 1).padStart(2, "0");
    const dd = String(stoppedAt.getDate()).padStart(2, "0");
    const payload = {
      date: `${yyyy}-${mm}-${dd}`,
      hours: Number((entry.durationSec / 3600).toFixed(2)),
      description: entry.source === "BASECAMP" ? "Tracked via BaseTrack" : entry.todoTitle,
    };

    let recordingId: string;

    if (entry.source === "BASECAMP") {
      recordingId = entry.todoId;
    } else {
      const found = await getProjectTimesheetRecordingId(user.basecampAccountId, entry.projectId, accessToken);
      if (!found) {
        syncError = "Project has no timesheet recording in Basecamp. Log a project-level time entry manually first.";
        throw new Error("bootstrap");
      }
      recordingId = found;
    }

    await createTimesheetEntry(user.basecampAccountId, recordingId, accessToken, payload);
    syncStatus = "SYNCED";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg !== "bootstrap") {
      console.error("[RETRY] Basecamp sync failed:", err);
      syncError = errMsg || "Basecamp sync failed";
    }
  }

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { syncStatus, syncError },
  });

  return data({ success: syncStatus === "SYNCED", syncError });
}
