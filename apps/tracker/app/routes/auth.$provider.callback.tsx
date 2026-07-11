import { redirect } from "react-router";
import { commitSession, getSession, getUserFromSessionId } from "../utils/session.server";
import { registry } from "../integrations/registry";
import { tokenService } from "../services/token.service.server";
import type { Route } from "./+types/auth.$provider.callback";

export async function loader({ params, request }: Route.LoaderArgs) {
  const provider = registry[params.provider];
  if (!provider) throw new Response("Unknown provider", { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) return redirect("/");

  const session = await getSession(request.headers.get("Cookie"));
  const savedState = session.get(`${params.provider}_oauth_state`) as string | undefined;

  if (!savedState || savedState !== state) {
    return new Response("Invalid state parameter (CSRF attempt)", { status: 400 });
  }

  session.unset(`${params.provider}_oauth_state`);

  const sessionId = session.get("sessionId") as string | undefined;
  const user = await getUserFromSessionId(sessionId ?? null);
  if (!user) return new Response("Not authenticated", { status: 401 });

  try {
    const tokenData = await provider.exchangeCode(code);
    await tokenService.saveToken(user.id, params.provider, tokenData);

    return redirect("/", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (err) {
    console.error(`${params.provider} OAuth callback error:`, err);
    return new Response("Authentication failed", { status: 500 });
  }
}
