import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { getValidAccessToken, getProjectTimesheetRecordingId } from "../utils/basecamp.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ available: false }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return data({ available: false }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken(user.id);
    const recordingId = await getProjectTimesheetRecordingId(user.basecampAccountId, projectId, accessToken);
    return data({ available: recordingId !== null });
  } catch {
    return data({ available: false });
  }
}
