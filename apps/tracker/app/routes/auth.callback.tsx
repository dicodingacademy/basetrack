import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { exchangeCodeForTokens, getLaunchpadAuthorization } from "../utils/basecamp.server";
import { prisma } from "../utils/db.server";
import { commitSession, getSession } from "../utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);
    const authData = await getLaunchpadAuthorization(tokenData.access_token);

    // Temukan account bc3 (Basecamp 3/4)
    const bc3Account = authData.accounts.find((acc) => acc.product === "bc3");
    if (!bc3Account) {
      return new Response("No Basecamp account found", { status: 400 });
    }

    const { identity } = authData;

    // Upsert user di database
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const user = await prisma.user.upsert({
      where: { basecampId: bc3Account.id.toString() },
      create: {
        basecampId: bc3Account.id.toString(),
        name: `${identity.first_name} ${identity.last_name}`.trim(),
        email: identity.email_address,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
      },
      update: {
        name: `${identity.first_name} ${identity.last_name}`.trim(),
        email: identity.email_address,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
      },
    });

    // Buat session baru (expired dalam 30 hari untuk cookie, meski token basecamp expire lebih cepat)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const dbSession = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt,
      },
    });

    // Simpan session id ke cookie
    const cookieSession = await getSession(request.headers.get("Cookie"));
    cookieSession.set("sessionId", dbSession.id);

    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(cookieSession, { expires: expiresAt }),
      },
    });
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    return new Response("Authentication failed", { status: 500 });
  }
}
