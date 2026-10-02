import type { LoaderFunctionArgs } from "react-router";
import { fetchProjects, getValidAccessToken } from "../utils/basecamp.server";
import { extError, extJson, preflight, requireExtensionUser } from "../utils/ext-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return preflight();
  const { user } = await requireExtensionUser(request);

  try {
    const accessToken = await getValidAccessToken(user.id);
    const projects = await fetchProjects(user.basecampAccountId, accessToken);
    return extJson({ projects });
  } catch (err) {
    console.error("[EXT] Failed to fetch Basecamp projects:", err);
    return extError(502, "basecamp_unavailable", "Could not load projects from Basecamp");
  }
}
