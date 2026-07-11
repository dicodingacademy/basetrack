import { data } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { registry } from "../integrations/registry";
import { getValidToken } from "../integrations/token.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ items: [] }, { status: 401 });

  const tabId = new URL(request.url).searchParams.get("tab");
  if (!tabId) return data({ items: [] }, { status: 400 });

  for (const provider of Object.values(registry)) {
    const tab = provider.tabs.find(t => t.id === tabId);
    if (!tab) continue;
    try {
      const accessToken = await getValidToken(user.id, provider.id);
      const items = await tab.fetchItems(accessToken);
      return data({ items });
    } catch (err) {
      console.error(`Failed to fetch items for tab ${tabId}:`, err);
      return data({ items: [] });
    }
  }

  return data({ items: [] }, { status: 404 });
}
