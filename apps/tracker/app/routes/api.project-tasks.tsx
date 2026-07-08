import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { fetchAssignments, getValidAccessToken } from "../utils/basecamp.server";
import type { BasecampAssignment } from "../types/basecamp";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ tasks: [] }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return data({ tasks: [] }, { status: 400 });

  const accessToken = await getValidAccessToken(user.id);
  const rawAssignments = await fetchAssignments(user.basecampAccountId, accessToken);

  const items: BasecampAssignment[] = rawAssignments;

  const tasks = items
    .filter((a) =>
      a.bucket?.id?.toString() === projectId &&
      a.completed !== true &&
      a.status !== "archived" &&
      a.status !== "trashed"
    )
    .map((curr) => ({
      id: curr.id.toString(),
      title: curr.title || curr.content || "Untitled Task",
      type: curr.type,
      dueOn: curr.due_on || null,
      assignees: curr.assignees?.map((a) => ({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatar_url,
      })) || [],
      parent: curr.parent
        ? { id: curr.parent.id, title: curr.parent.title, type: curr.parent.type }
        : undefined,
    }));

  return data({ tasks });
}
