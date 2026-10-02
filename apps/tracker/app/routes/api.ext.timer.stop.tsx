import type { ActionFunctionArgs } from "react-router";
import { extError, extJson, preflightLoader, requireExtensionUser } from "../utils/ext-api.server";
import { callWsInternal } from "../utils/ws.server";

export const loader = preflightLoader;

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireExtensionUser(request);

  try {
    const result = await callWsInternal<{ stopped: boolean }>("/internal/timer/stop", { userId: user.id });
    return extJson({ stopped: result.stopped });
  } catch (err) {
    console.error("[EXT] Failed to stop timer:", err);
    return extError(502, "ws_unavailable", "Timer service is unavailable");
  }
}
