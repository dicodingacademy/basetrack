// Basecamp timesheet descriptions for items started from the extension.
// One fact per line; empty parts are dropped.
const lines = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join("\n");

export const describeCalendarEvent = (event: { title: string; when?: string | null; meetUrl?: string | null }) =>
  lines(`[Google Calendar] ${event.title}`, event.when, event.meetUrl);

export const describeGoogleDoc = (doc: { docId: string; title: string }) =>
  lines(`[Google Docs] ${doc.title}`, `https://docs.google.com/document/d/${doc.docId}`);

export const describeGithubItem = (item: { title: string; url: string }) => lines(`[Github] ${item.title}`, item.url);
