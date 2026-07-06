import { redirect } from "react-router";
import { getGoogleAuthUrl } from "../utils/google.server";
import type { Route } from "./+types/auth.google";
import { getSession, commitSession } from "../utils/session.server";
import { randomBytes } from "node:crypto";

export async function loader({ request }: Route.LoaderArgs) {
  const state = randomBytes(16).toString("hex");
  const url = getGoogleAuthUrl(state);

  const session = await getSession(request.headers.get("Cookie"));
  session.set("google_oauth_state", state);

  return redirect(url, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
