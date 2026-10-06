import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import { findDialogToolbar, findEditPageEvent, findEventDialogs, type CalendarEvent, type EventDialog } from "../content/sites/gcal";
import type { ItemInfo } from "../lib/types";
import { describeCalendarEvent } from "../lib/description";

const toItem = (event: CalendarEvent): ItemInfo => ({
  source: "GOOGLE_CALENDAR",
  externalId: event.eventId,
  title: event.title,
  description: describeCalendarEvent(event),
  context: { key: `gcal:${event.calendarId}`, label: event.calendarId === "unknown" ? "this calendar" : event.calendarId },
});

type Entry = { widget: Widget | null; toolbar: HTMLElement | null; open: boolean };

export default defineContentScript({
  matches: ["https://calendar.google.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const dialogs = new Map<HTMLElement, Entry>();
    let editWidget: Widget | null = null;

    function insert(widget: Widget, dialog: HTMLElement, toolbar: HTMLElement | null, anchor: HTMLElement | null) {
      if (toolbar) {
        if (widget.host.parentElement !== toolbar) {
          toolbar.prepend(widget.host);
          widget.host.style.alignSelf = "center";
          widget.host.style.marginRight = "8px";
        }
        return;
      }
      if (dialog.contains(widget.host)) return;
      const row = anchor?.parentElement && anchor.parentElement !== dialog ? anchor.parentElement : anchor;
      if (!row) dialog.prepend(widget.host);
      else if (widget.host.previousElementSibling !== row) row.insertAdjacentElement("afterend", widget.host);
    }

    function remount() {
      for (const [dialog, entry] of dialogs) {
        if (!entry.widget || !entry.open || !dialog.isConnected) continue;
        const toolbar = findDialogToolbar(dialog);
        if (!toolbar) continue;
        entry.toolbar = toolbar;
        if (entry.widget.host.parentElement !== toolbar) {
          toolbar.prepend(entry.widget.host);
          entry.widget.host.style.alignSelf = "center";
          entry.widget.host.style.marginRight = "8px";
        }
      }
    }
    const remountObserver = new MutationObserver(remount);
    remountObserver.observe(document.documentElement, { childList: true, subtree: true });

    function scan() {
      const found = findEventDialogs();
      const live = new Set(found.map((d) => d.dialog));

      for (const [dialog, entry] of dialogs) {
        if (!live.has(dialog) || !dialog.isConnected) {
          entry.widget?.destroy();
          dialogs.delete(dialog);
        }
      }

      for (const item of found) {
        const { dialog } = item;
        let entry = dialogs.get(dialog);
        if (!entry) {
          entry = { widget: null, toolbar: null, open: false };
          dialogs.set(dialog, entry);
        }

        entry.open = Number(getComputedStyle(dialog).opacity) > 0.5;

        if (!entry.open) {
          entry.widget?.destroy();
          entry.widget = null;
          continue;
        }

        if (!entry.widget) entry.widget = createWidget({ placement: "below" });
        entry.toolbar = item.toolbar;
        insert(entry.widget, dialog, item.toolbar, item.anchor);
        entry.widget.setItem(toItem(item.event));
      }

      const editEvent = findEditPageEvent();
      if (editEvent) {
        if (!editWidget) {
          editWidget = createWidget({ placement: "above", floating: true });
          document.body.append(editWidget.host);
        }
        editWidget.setItem(toItem(editEvent));
      } else if (editWidget) {
        editWidget.destroy();
        editWidget = null;
      }
    }

    watchPage(ctx, scan);
    ctx.onInvalidated(() => {
      remountObserver.disconnect();
      for (const entry of dialogs.values()) entry.widget?.destroy();
      editWidget?.destroy();
    });
  },
});
