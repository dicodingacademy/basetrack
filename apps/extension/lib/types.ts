export type Source = "GOOGLE_CALENDAR" | "GOOGLE_DOCS" | "GOOGLE_SHEETS" | "GOOGLE_SLIDES" | "GITHUB_PROJECT";

export const SOURCES: { key: Source; label: string }[] = [
  { key: "GOOGLE_CALENDAR", label: "Google Calendar" },
  { key: "GOOGLE_DOCS", label: "Google Docs" },
  { key: "GOOGLE_SHEETS", label: "Google Sheets" },
  { key: "GOOGLE_SLIDES", label: "Google Slides" },
  { key: "GITHUB_PROJECT", label: "GitHub Projects" },
];

export type GFileKind = "document" | "spreadsheets" | "presentation";

export type Project = { id: string; name: string };

export type ActiveTimer = {
  todoId: string;
  todoTitle: string;
  projectId: string;
  projectName: string;
  source: string;
  startedAt: string;
};

export type User = { name: string; email: string; timezone?: string };

export type AuthState = { token: string; user: User } | null;

export type TimerState = { activeTimer: ActiveTimer | null; fetchedAt: number };

export type TrackingContext = {
  key: string;
  label: string;
  source: Source;
  lastSeen: number;
};

export type Mappings = {
  defaults: Partial<Record<Source, Project>>;
  contexts: Record<string, Project>;
};

export type ItemInfo = {
  source: Source;
  externalId: string;
  title: string;
  description?: string;
  context: { key: string; label: string };
};

export type StartRequest = {
  item: ItemInfo;
  project: Project;
  remember: boolean;
};

export type ApiError = { ok: false; status: number; error: string; message: string };

export type Message =
  | { type: "getState" }
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "refresh" }
  | { type: "getProjects"; force?: boolean }
  | { type: "start"; request: StartRequest }
  | { type: "stop" }
  | { type: "openOptions" };

export type StateResponse = {
  connected: boolean;
  user: User | null;
  activeTimer: ActiveTimer | null;
};

export type ProjectsResponse = { ok: true; projects: Project[] } | ApiError;

export type StartResponse =
  | { ok: true; activeTimer: ActiveTimer; switchedFrom: { todoTitle: string; durationSec: number } | null }
  | ApiError;

export type SimpleResponse = { ok: true } | ApiError;
