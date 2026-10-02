import type { ActionFunctionArgs } from "react-router";
import { getProjectTimesheetRecordingId, getValidAccessToken } from "../utils/basecamp.server";
import { extError, extJson, preflightLoader, requireExtensionUser } from "../utils/ext-api.server";
import { callWsInternal } from "../utils/ws.server";

const EXTENSION_SOURCES = new Set(["GOOGLE_CALENDAR", "GOOGLE_DOCS", "GITHUB_PROJECT"]);

function isText(value: unknown, max = 255): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export const loader = preflightLoader;

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireExtensionUser(request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return extError(400, "invalid_request", "Body must be JSON");
  }

  const { source, externalId, title, description, projectId, projectName } = body;
  if (
    (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) ||
    typeof source !== "string" || !EXTENSION_SOURCES.has(source) ||
    !isText(externalId) || !isText(title) || !isText(projectName) ||
    typeof projectId !== "string" || !/^\d+$/.test(projectId)
  ) {
    return extError(400, "invalid_request", "source, externalId, title, projectId and projectName are required");
  }

  // Extension items sync to the project-level timesheet; fail now rather than when the timer stops.
  try {
    const accessToken = await getValidAccessToken(user.id);
    const recordingId = await getProjectTimesheetRecordingId(user.basecampAccountId, projectId, accessToken);
    if (!recordingId) {
      return extError(
        422,
        "timesheet_unavailable",
        `"${projectName}" has no time entries in Basecamp yet. Log one time entry manually on this project's timesheet first.`
      );
    }
  } catch (err) {
    console.error("[EXT] Timesheet check failed:", err);
    return extError(502, "basecamp_unavailable", "Could not reach Basecamp");
  }

  try {
    const result = await callWsInternal<{
      timer: { todoId: string; todoTitle: string; projectId: string; projectName: string; source: string; startedAt: string };
      switchedFrom: { todoTitle: string; durationSec: number } | null;
    }>("/internal/timer/start", {
      userId: user.id,
      todoId: externalId.trim(),
      todoTitle: title.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      projectId,
      projectName: projectName.trim(),
      source,
    });

    const { timer } = result;
    return extJson({
      activeTimer: {
        todoId: timer.todoId,
        todoTitle: timer.todoTitle,
        projectId: timer.projectId,
        projectName: timer.projectName,
        source: timer.source,
        startedAt: timer.startedAt,
      },
      switchedFrom: result.switchedFrom,
    });
  } catch (err) {
    console.error("[EXT] Failed to start timer:", err);
    return extError(502, "ws_unavailable", "Timer service is unavailable");
  }
}
