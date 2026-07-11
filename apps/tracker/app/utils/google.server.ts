type RawGoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

type RawGoogleTaskList = { id: string; title: string };
type RawGoogleTask = { id: string; title?: string; notes?: string; due?: string };

export async function fetchCalendarEvents(accessToken: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch calendar events: ${errorText}`);
  }

  const data = await response.json() as { items?: RawGoogleCalendarEvent[] };
  return (data.items || []).filter((e) => e.status !== "cancelled");
}

export async function fetchTaskLists(accessToken: string) {
  const response = await fetch(
    "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch task lists: ${errorText}`);
  }

  const data = await response.json() as { items?: RawGoogleTaskList[] };
  return (data.items || []).map((list) => ({
    id: list.id,
    title: list.title,
  }));
}

export async function fetchTasks(accessToken: string, taskListId: string) {
  const params = new URLSearchParams({
    showHidden: "false",
    showCompleted: "false",
  });

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch tasks: ${errorText}`);
  }

  const data = await response.json() as { items?: RawGoogleTask[] };
  return (data.items || []).map((task) => ({
    id: task.id,
    title: task.title,
    notes: task.notes,
    due: task.due,
  }));
}
