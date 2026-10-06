import { query, queryAll } from "../dom";
import { textOf } from "../watch";

export const GCAL = {
  dialogs: ['[role="dialog"][data-chips-dialog="true"]'],
  meetLink: 'a[href*="meet.google.com/"]',
  eventId: "[data-eventid]",
  dialogTitle: ['[role="heading"]'],
  editTitle: ['[role="main"] input[type="text"]'],
};

export type CalendarEvent = {
  eventId: string;
  calendarId: string;
  title: string;
  when?: string | null;
  meetUrl?: string | null;
};

export function decodeEventId(raw: string): { eventId: string; calendarId: string } {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const [eventId, calendarId] = decoded.split(" ");
    if (eventId && /^[\w-]+$/.test(eventId)) {
      return { eventId, calendarId: expandCalendarId(calendarId ?? "") || "unknown" };
    }
  } catch {}
  return { eventId: raw, calendarId: "unknown" };
}

function expandCalendarId(id: string): string {
  if (id.endsWith("@m")) return id.slice(0, -2) + "@gmail.com";
  if (id.endsWith("@g")) return id.slice(0, -2) + "@group.calendar.google.com";
  return id;
}

export function findDialogToolbar(dialog: HTMLElement): HTMLElement | null {
  const close = dialog.querySelector<HTMLElement>("button");
  for (let el = close?.parentElement; el && el !== dialog; el = el.parentElement) {
    const sibling = [...(el.parentElement?.children ?? [])].find((c) => c !== el && c.querySelector("button"));
    if (sibling) return sibling as HTMLElement;
  }
  return null;
}

function findWhen(heading: HTMLElement | null): string | null {
  const text = textOf(heading?.parentElement?.nextElementSibling).replace(/\s*⋅\s*/g, " · ");
  return /\d/.test(text) ? text : null;
}

function findMeetUrl(dialog: HTMLElement): string | null {
  const link = dialog.querySelector<HTMLAnchorElement>(GCAL.meetLink);
  if (!link) return null;
  try {
    const url = new URL(link.href);
    return url.pathname.length > 1 ? `https://meet.google.com${url.pathname}` : null;
  } catch {
    return null;
  }
}

export type EventDialog = {
  dialog: HTMLElement;
  toolbar: HTMLElement | null;
  anchor: HTMLElement | null;
  event: CalendarEvent;
};

export function findEventDialogs(): EventDialog[] {
  const seen = new Set<HTMLElement>();
  const found: EventDialog[] = [];

  for (const dialog of queryAll<HTMLElement>(document, GCAL.dialogs)) {
    if (seen.has(dialog)) continue;
    seen.add(dialog);
    if (found.some((f) => f.dialog.contains(dialog) || dialog.contains(f.dialog))) continue;

    let raw = dialog.getAttribute("data-eventid");
    if (!raw) {
      const ids = new Set([...dialog.querySelectorAll(GCAL.eventId)].map((el) => el.getAttribute("data-eventid")));
      if (ids.size !== 1) continue;
      raw = [...ids][0] ?? null;
    }
    if (!raw) continue;
    const heading = query<HTMLElement>(dialog, GCAL.dialogTitle);
    const { eventId, calendarId } = decodeEventId(raw);
    found.push({
      dialog,
      toolbar: findDialogToolbar(dialog),
      anchor: heading,
      event: {
        eventId,
        calendarId,
        title: textOf(heading) || "Untitled event",
        when: findWhen(heading),
        meetUrl: findMeetUrl(dialog),
      },
    });
  }
  return found;
}

export function findEditPageEvent(): CalendarEvent | null {
  const match = location.pathname.match(/\/r\/eventedit\/([^/?#]+)/);
  if (!match) return null;
  const input = query<HTMLInputElement>(document, GCAL.editTitle);
  const { eventId, calendarId } = decodeEventId(decodeURIComponent(match[1] ?? ""));
  return { eventId, calendarId, title: input?.value.trim() || "Untitled event" };
}
