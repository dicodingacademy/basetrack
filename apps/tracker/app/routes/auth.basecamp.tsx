import { redirect } from "react-router";
import { getAuthorizationUrl } from "../utils/basecamp.server";
import type { Route } from "./+types/auth.basecamp";
import { getSession, commitSession } from "../utils/session.server";
import { randomBytes } from "node:crypto";
import { safeReturnTo } from "../utils/redirect.server";

export async function loader({ request }: Route.LoaderArgs) {
  const state = randomBytes(16).toString("hex");
  const url = getAuthorizationUrl(state);
  
  const session = await getSession(request.headers.get("Cookie"));
  session.set("oauth_state", state);

  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  if (returnTo) session.set("returnTo", returnTo);
  else session.unset("returnTo");

  return redirect(url, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
