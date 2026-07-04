import { redirect } from "react-router";
import { getAuthorizationUrl } from "../utils/basecamp.server";
import type { Route } from "./+types/auth.basecamp";
import { getSession, commitSession } from "../utils/session.server";
import { randomBytes } from "node:crypto";

export async function loader({ request }: Route.LoaderArgs) {
  const state = randomBytes(16).toString("hex");
  const url = getAuthorizationUrl(state);
  
  const session = await getSession(request.headers.get("Cookie"));
  session.set("oauth_state", state);

  return redirect(url, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
