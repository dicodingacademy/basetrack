import { Briefcase, Calendar, FileSpreadsheet, FileText, ListTodo, Presentation, SquareKanban } from "lucide-react";

export const SOURCES = [
  { key: "BASECAMP",        param: "basecamp", label: "Basecamp",        icon: Briefcase,       bar: "bg-primary",     color: "var(--primary)" },
  { key: "GOOGLE_CALENDAR", param: "calendar", label: "Google Calendar", icon: Calendar,        bar: "bg-blue-500",    color: "#3b82f6" },
  { key: "GOOGLE_TASKS",    param: "tasks",    label: "Google Tasks",    icon: ListTodo,        bar: "bg-emerald-500", color: "#22c55e" },
  { key: "GOOGLE_DOCS",     param: "docs",     label: "Google Docs",     icon: FileText,        bar: "bg-sky-500",     color: "#0ea5e9" },
  { key: "GOOGLE_SHEETS",   param: "sheets",   label: "Google Sheets",   icon: FileSpreadsheet, bar: "bg-green-500",   color: "#16a34a" },
  { key: "GOOGLE_SLIDES",   param: "slides",   label: "Google Slides",   icon: Presentation,    bar: "bg-amber-500",   color: "#f59e0b" },
  { key: "GITHUB_PROJECT",  param: "github",   label: "GitHub Projects", icon: SquareKanban,    bar: "bg-violet-500",  color: "#8b5cf6" },
] as const;

export type TimerSource = (typeof SOURCES)[number]["key"];

export function getSource(key: string) {
  return SOURCES.find(s => s.key === key);
}

export function sourceFromParam(param: string): TimerSource | undefined {
  return SOURCES.find(s => s.param === param)?.key;
}
