import { prisma } from "./db.server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

function assertGoogleConfig() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Missing Google OAuth configuration. Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are set in .env");
  }
}

export function getGoogleAuthUrl(state: string) {
  assertGoogleConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  assertGoogleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Google token: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  }>;
}

export async function refreshGoogleToken(refreshToken: string) {
  assertGoogleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google token: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>;
}

export async function getValidGoogleToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleAccessToken || !user.googleRefreshToken || !user.googleTokenExpiresAt) {
    throw new Error("Google not connected");
  }

  if (user.googleTokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const tokenData = await refreshGoogleToken(user.googleRefreshToken);
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: tokenData.access_token,
        googleTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });
    return tokenData.access_token;
  }

  return user.googleAccessToken;
}

export async function revokeGoogleToken(accessToken: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  });
}

export async function disconnectGoogle(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.googleAccessToken) {
      await revokeGoogleToken(user.googleAccessToken);
    }
  } catch (e) {
    console.error("Failed to revoke Google token:", e);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
    },
  });
}
