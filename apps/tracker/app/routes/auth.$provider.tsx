import { redirect } from "react-router";
import { randomBytes } from "node:crypto";
import { getSession, commitSession } from "../utils/session.server";
import { registry } from "../integrations/registry";
import type { Route } from "./+types/auth.$provider";

export async function loader({ params, request }: Route.LoaderArgs) {
  const provider = registry[params.provider];
  if (!provider) throw new Response("Unknown provider", { status: 404 });

  provider.assertConfig();
  const state = randomBytes(16).toString("hex");
  const session = await getSession(request.headers.get("Cookie"));
  session.set(`${params.provider}_oauth_state`, state);

  return redirect(provider.buildAuthUrl(state), {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
