import { fetchCalendarEvents, fetchTaskLists, fetchTasks } from "../../utils/google.server";
import type { OAuthProvider, ProviderTab, TokenResult, TrackableItem } from "../types";

async function fetchCalendarItems(accessToken: string): Promise<TrackableItem[]> {
  const events = await fetchCalendarEvents(accessToken, new Date());
  return events.map(e => ({
    id: e.id,
    title: e.summary || "Untitled Event",
    timeLabel: e.start?.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "All day",
    url: e.htmlLink,
    source: "GOOGLE_CALENDAR",
    type: "event",
  }));
}

async function fetchTaskItems(accessToken: string): Promise<TrackableItem[]> {
  const taskLists = await fetchTaskLists(accessToken);
  const allItems: TrackableItem[] = [];
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  for (const list of taskLists) {
    try {
      const tasks = await fetchTasks(accessToken, list.id);
      for (const t of tasks) {
        if (!t.due) continue;
        if (new Date(t.due) > endOfToday) continue;
        allItems.push({
          id: t.id,
          title: t.title || "Untitled Task",
          timeLabel: new Date(t.due).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          subtitle: list.title,
          source: "GOOGLE_TASKS",
          type: "task",
        });
      }
    } catch {
      // skip failed list, continue with others
    }
  }
  return allItems;
}

export class GoogleProvider implements OAuthProvider {
  readonly id = "google";
  readonly label = "Google";
  readonly scopes = "Calendar & Tasks";

  readonly tabs: ProviderTab[] = [
    { id: "calendar", label: "Calendar", iconName: "Calendar", fetchItems: fetchCalendarItems },
    { id: "tasks", label: "Tasks", iconName: "ListTodo", fetchItems: fetchTaskItems },
  ];

  assertConfig() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI");
    }
  }

  buildAuthUrl(state: string): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<TokenResult> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!res.ok) throw new Error(`Google exchange failed: ${await res.text()}`);
    const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResult> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`Google refresh failed: ${await res.text()}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  async revokeToken(accessToken: string): Promise<void> {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: accessToken }),
    });
  }
}
