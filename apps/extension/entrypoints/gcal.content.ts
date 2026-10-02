import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import { findEditPageEvent, findEventDialogs, type CalendarEvent, type EventDialog } from "../content/sites/gcal";
import type { ItemInfo } from "../lib/types";

const toItem = (event: CalendarEvent): ItemInfo => ({
  source: "GOOGLE_CALENDAR",
  externalId: event.eventId,
  title: event.title,
  context: { key: `gcal:${event.calendarId}`, label: event.calendarId === "unknown" ? "this calendar" : event.calendarId },
});

export default defineContentScript({
  matches: ["https://calendar.google.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const dialogWidgets = new Map<HTMLElement, Widget>();
    let editWidget: Widget | null = null;

    function mountInDialog(widget: Widget, { dialog, toolbar, anchor }: EventDialog) {
      if (toolbar) {
        // First in the Edit / Delete / Options group, i.e. left of the pencil.
        if (toolbar.firstElementChild !== widget.host) toolbar.prepend(widget.host);
        widget.host.style.alignSelf = "center";
        widget.host.style.marginRight = "8px";
        return;
      }
      if (dialog.contains(widget.host)) return;
      // Toolbar not recognised: fall back to right under the title row.
      const row = anchor?.parentElement && anchor.parentElement !== dialog ? anchor.parentElement : anchor;
      if (row) row.insertAdjacentElement("afterend", widget.host);
      else dialog.prepend(widget.host);
    }

    function scan() {
      const dialogs = findEventDialogs();
      const live = new Set(dialogs.map((d) => d.dialog));

      for (const [dialog, widget] of dialogWidgets) {
        if (!live.has(dialog) || !dialog.isConnected) {
          widget.destroy();
          dialogWidgets.delete(dialog);
        }
      }

      for (const found of dialogs) {
        let widget = dialogWidgets.get(found.dialog);
        if (!widget) {
          widget = createWidget({ placement: "below" });
          dialogWidgets.set(found.dialog, widget);
        }
        mountInDialog(widget, found);
        widget.setItem(toItem(found.event));
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
      for (const w of dialogWidgets.values()) w.destroy();
      editWidget?.destroy();
    });
  },
});
