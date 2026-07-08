
import { prisma } from "./db.server";

const CLIENT_ID = process.env.BASECAMP_CLIENT_ID;
const CLIENT_SECRET = process.env.BASECAMP_CLIENT_SECRET;
const REDIRECT_URI = process.env.BASECAMP_REDIRECT_URI;

export function getAuthorizationUrl(state: string) {
  const url = new URL("https://launchpad.37signals.com/authorization/new");
  url.searchParams.set("type", "web_server");
  url.searchParams.set("client_id", CLIENT_ID!);
  url.searchParams.set("redirect_uri", REDIRECT_URI!);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch("https://launchpad.37signals.com/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      type: "web_server",
      client_id: CLIENT_ID!,
      redirect_uri: REDIRECT_URI!,
      client_secret: CLIENT_SECRET!,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange tokens: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
  }>;
}

export async function getLaunchpadAuthorization(accessToken: string) {
  const response = await fetch("https://launchpad.37signals.com/authorization.json", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch launchpad authorization");
  }

  return response.json() as Promise<{
    expires_at: string;
    identity: {
      id: number;
      first_name: string;
      last_name: string;
      email_address: string;
    };
    accounts: Array<{
      product: string;
      id: number;
      name: string;
      href: string;
    }>;
  }>;
}

export async function refreshBasecampToken(refreshToken: string) {
  const response = await fetch("https://launchpad.37signals.com/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      type: "refresh",
      client_id: CLIENT_ID!,
      redirect_uri: REDIRECT_URI!,
      client_secret: CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

export async function getValidAccessToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const tokenData = await refreshBasecampToken(user.refreshToken);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: tokenData.access_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });
    return updatedUser.accessToken;
  }

  return user.accessToken;
}

export async function fetchAssignments(accountId: string, accessToken: string) {
  const response = await fetch(`https://3.basecampapi.com/${accountId}/my/assignments.json`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "BaseTrack (app@basetrack.local)",
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch assignments: ${err}`);
  }

  return response.json();
}

export async function fetchProjectDetails(accountId: string, bucketIds: string[], accessToken: string) {
  const promises = bucketIds.map(async (id) => {
    const response = await fetch(`https://3.basecampapi.com/${accountId}/projects/${id}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "BaseTrack (app@basetrack.local)",
      },
    });
    if (!response.ok) return null;
    return response.json();
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

export async function createTimesheetEntry(
  accountId: string,
  assignmentId: string,
  accessToken: string,
  data: { date: string; hours: number; description: string }
) {
  const response = await fetch(`https://3.basecampapi.com/${accountId}/recordings/${assignmentId}/timesheet/entries.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "BaseTrack (app@basetrack.local)",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create timesheet entry: ${err}`);
  }

  return response.json();
}

export async function getProjectTimesheetRecordingId(
  accountId: string,
  projectId: string,
  accessToken: string
): Promise<string | null> {
  // Project-level timesheet entries have parent.type === "Timesheet".
  // The timesheet tool does NOT appear in the project's dock array —
  // we must discover its recording ID from existing project-level entries.
  let url = `https://3.basecampapi.com/${accountId}/projects/${projectId}/timesheet.json`;

  for (;;) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "BaseTrack (app@basetrack.local)",
      },
    });

    if (!res.ok) return null;

    const entries = await res.json() as { parent: { id: number; type: string } }[];

    for (const entry of entries) {
      if (entry.parent?.type === "Timesheet") {
        return entry.parent.id.toString();
      }
    }

    const link: string | null = res.headers.get("Link");
    const nextMatch: RegExpMatchArray | null = link ? link.match(/<([^>]+)>;\s*rel="next"/) : null;
    if (!nextMatch) break;
    url = nextMatch[1];
  }

  return null;
}
