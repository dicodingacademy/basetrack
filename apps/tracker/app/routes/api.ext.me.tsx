import type { LoaderFunctionArgs } from "react-router";
import { getActiveTimer } from "../services/timer.server";
import { extJson, preflight, requireExtensionUser } from "../utils/ext-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return preflight();
  const { user } = await requireExtensionUser(request);
  const timer = await getActiveTimer(user.id);

  return extJson({
    user: { name: user.name, email: user.email, timezone: user.timezone },
    activeTimer: timer && {
      todoId: timer.todoId,
      todoTitle: timer.todoTitle,
      projectId: timer.projectId,
      projectName: timer.projectName,
      source: timer.source,
      startedAt: timer.startedAt.toISOString(),
    },
  });
}
