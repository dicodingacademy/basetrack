import type { PrismaClient } from "@prisma/client";

const CLIENT_ID = process.env.BASECAMP_CLIENT_ID;
const CLIENT_SECRET = process.env.BASECAMP_CLIENT_SECRET;
const REDIRECT_URI = process.env.BASECAMP_REDIRECT_URI || "";

export async function refreshBasecampToken(refreshToken: string) {
  const response = await fetch("https://launchpad.37signals.com/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      type: "refresh",
      client_id: CLIENT_ID!,
      redirect_uri: REDIRECT_URI,
      client_secret: CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getValidAccessToken(userId: string, prisma: PrismaClient) {
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

export async function createTimesheetEntry(
  accountId: string,
  assignmentId: string,
  accessToken: string,
  data: { date: string; hours: number; description: string }
) {
  const response = await fetch(
    `https://3.basecampapi.com/${accountId}/recordings/${assignmentId}/timesheet/entries.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "BaseTrack (app@basetrack.local)",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

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

    const entries = (await res.json()) as { parent: { id: number; type: string } }[];

    for (const entry of entries) {
      if (entry.parent?.type === "Timesheet") {
        return entry.parent.id.toString();
      }
    }

    // Follow Link header pagination
    const link: string | null = res.headers.get("Link");
    const nextMatch: RegExpMatchArray | null = link ? link.match(/<([^>]+)>;\s*rel="next"/) : null;
    if (!nextMatch) break;
    url = nextMatch[1];
  }

  // No project-level entries exist yet — recording ID cannot be discovered.
  return null;
}
