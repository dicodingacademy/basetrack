import type { GFileKind } from "./types";

const lines = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join("\n");

export const describeCalendarEvent = (event: { title: string; when?: string | null; meetUrl?: string | null }) =>
  lines(`[Google Calendar] ${event.title}`, event.when, event.meetUrl);

const GFILES: Record<GFileKind, { label: string; path: string }> = {
  document: { label: "Google Docs", path: "document" },
  spreadsheets: { label: "Google Sheets", path: "spreadsheets" },
  presentation: { label: "Google Slides", path: "presentation" },
};

export const describeGoogleFile = (kind: GFileKind, file: { fileId: string; title: string }) =>
  lines(`[${GFILES[kind].label}] ${file.title}`, `https://docs.google.com/${GFILES[kind].path}/d/${file.fileId}`);

export const describeGithubItem = (item: { title: string; url: string }) => lines(`[Github] ${item.title}`, item.url);
