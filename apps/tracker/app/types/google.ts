export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  htmlLink?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
};

export type GoogleTaskList = {
  id: string;
  title: string;
};

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  taskListId: string;
  taskListName: string;
};

export type TimerSource = "BASECAMP" | "GOOGLE_CALENDAR" | "GOOGLE_TASKS";
