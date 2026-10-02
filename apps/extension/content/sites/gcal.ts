import { textOf } from "../watch";

// Google Calendar's markup is obfuscated and changes without notice; everything
// site-specific lives here so it can be fixed in one place.
// Verified on the live week view (2026-10): the detail popover is a
// [role="dialog"] without an id, its toolbar row holds the Close button
// (#xDetDlgCloseBu) next to a group with Edit / Delete / Options.
export const GCAL = {
  /** Event detail popover. `#xDetDlg` has been stable for years; the rest are fallbacks. */
  dialogs: ['#xDetDlg', '[role="dialog"][data-eventid]', '[role="dialog"]'],
  /** Close button of the detail popover; aria-labels are localized, the id isn't. */
  closeButton: ['#xDetDlgCloseBu', 'button[aria-label="Close"]', 'button[aria-label="Tutup"]'],
  /** Google Meet join link inside the popover. */
  meetLink: 'a[href*="meet.google.com/"]',
  /** Element carrying the encoded event id, searched inside a dialog. */
  eventId: "[data-eventid]",
  /** Event title inside the popover. `#rAECCd` is the title span id. */
  dialogTitle: ['#rAECCd', '[role="heading"]', "h1, h2"],
  /** Title input on the full edit page (`/r/eventedit/<b64>`). aria-label is localized. */
  editTitle: [
    'input[aria-label="Title"]',
    'input[aria-label="Add title"]',
    'input[aria-label="Judul"]',
    'input[aria-label="Tambahkan judul"]',
    '[role="main"] input[type="text"]',
  ],
};

export type CalendarEvent = {
  eventId: string;
  calendarId: string;
  title: string;
  /** Date/time line as shown in the popover, e.g. "Wednesday, September 30 · 8:30 – 9:30am". */
  when?: string | null;
  meetUrl?: string | null;
};

/**
 * `data-eventid` / the eventedit path segment is base64 (often url-safe, often
 * unpadded) of "<eventId> <calendarId>", where calendarId may be abbreviated:
 * "user@m" → gmail.com, "abc@g" → group.calendar.google.com.
 */
export function decodeEventId(raw: string): { eventId: string; calendarId: string } {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const [eventId, calendarId] = decoded.split(" ");
    if (eventId && /^[\w-]+$/.test(eventId)) {
      return { eventId, calendarId: expandCalendarId(calendarId ?? "") || "unknown" };
    }
  } catch {
    // not base64 — fall through and use the raw value
  }
  return { eventId: raw, calendarId: "unknown" };
}

function expandCalendarId(id: string): string {
  if (id.endsWith("@m")) return id.slice(0, -2) + "@gmail.com";
  if (id.endsWith("@g")) return id.slice(0, -2) + "@group.calendar.google.com";
  return id;
}

export function findFirst<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const sel of selectors) {
    const el = root.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * The icon group (Edit / Delete / Options) in the popover's toolbar row: the
 * sibling of the Close button's container that also holds buttons.
 */
function findToolbarGroup(dialog: HTMLElement): HTMLElement | null {
  const close = findFirst<HTMLElement>(dialog, GCAL.closeButton);
  for (let el = close?.parentElement; el && el !== dialog; el = el.parentElement) {
    const sibling = [...(el.parentElement?.children ?? [])].find((c) => c !== el && c.querySelector("button"));
    if (sibling) return sibling as HTMLElement;
  }
  return null;
}

/** The line right after the title row holds the date and time (verified 2026-10; class names are obfuscated). */
function findWhen(heading: HTMLElement | null): string | null {
  const text = textOf(heading?.parentElement?.nextElementSibling).replace(/\s*⋅\s*/g, " · ");
  return /\d/.test(text) ? text : null;
}

function findMeetUrl(dialog: HTMLElement): string | null {
  const link = dialog.querySelector<HTMLAnchorElement>(GCAL.meetLink);
  if (!link) return null;
  try {
    const url = new URL(link.href);
    return url.pathname.length > 1 ? `https://meet.google.com${url.pathname}` : null; // drop ?authuser=… etc.
  } catch {
    return null;
  }
}

export type EventDialog = { dialog: HTMLElement; toolbar: HTMLElement | null; anchor: HTMLElement | null; event: CalendarEvent };

/** Event detail dialogs currently on screen, with their decoded event. */
export function findEventDialogs(): EventDialog[] {
  const seen = new Set<HTMLElement>();
  const found: EventDialog[] = [];

  for (const sel of GCAL.dialogs) {
    for (const dialog of document.querySelectorAll<HTMLElement>(sel)) {
      if (seen.has(dialog)) continue;
      seen.add(dialog);
      // The more specific selectors run first; skip wrappers of a dialog we already have.
      if (found.some((f) => f.dialog.contains(dialog) || dialog.contains(f.dialog))) continue;

      let raw = dialog.getAttribute("data-eventid");
      if (!raw) {
        // A dialog listing several events (e.g. "+3 more") isn't an event detail view.
        const ids = new Set([...dialog.querySelectorAll(GCAL.eventId)].map((el) => el.getAttribute("data-eventid")));
        if (ids.size !== 1) continue;
        raw = [...ids][0] ?? null;
      }
      if (!raw) continue;
      const heading = findFirst<HTMLElement>(dialog, GCAL.dialogTitle);
      const { eventId, calendarId } = decodeEventId(raw);
      found.push({
        dialog,
        toolbar: findToolbarGroup(dialog),
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
  }
  return found;
}

/** The full-page event editor, if open. */
export function findEditPageEvent(): CalendarEvent | null {
  const match = location.pathname.match(/\/r\/eventedit\/([^/?#]+)/);
  if (!match) return null;
  const input = findFirst<HTMLInputElement>(document, GCAL.editTitle);
  const { eventId, calendarId } = decodeEventId(decodeURIComponent(match[1] ?? ""));
  return { eventId, calendarId, title: input?.value.trim() || "Untitled event" };
}
