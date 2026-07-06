import { redirect } from "react-router";
import type { Route } from "./+types/auth.google.callback";
import { exchangeGoogleCode } from "../utils/google.server";
import { prisma } from "../utils/db.server";
import { commitSession, getSession, getUserFromSessionId } from "../utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect("/");
  }

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const cookieSession = await getSession(request.headers.get("Cookie"));
  const savedState = cookieSession.get("google_oauth_state");

  if (!savedState || savedState !== state) {
    return new Response("Invalid state parameter (CSRF attempt detected)", { status: 400 });
  }

  cookieSession.unset("google_oauth_state");

  const sessionId = cookieSession.get("sessionId") as string | undefined;
  const user = await getUserFromSessionId(sessionId ?? null);

  if (!user) {
    return new Response("You must be logged in to connect Google", { status: 401 });
  }

  try {
    const tokenData = await exchangeGoogleCode(code);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token,
        googleTokenExpiresAt: tokenExpiresAt,
      },
    });

    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(cookieSession),
      },
    });
  } catch (error) {
    console.error("Google OAuth Callback Error:", error);
    return new Response("Google authentication failed", { status: 500 });
  }
}
