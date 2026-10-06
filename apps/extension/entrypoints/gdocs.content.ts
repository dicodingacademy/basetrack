import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import { describeGoogleDoc } from "../lib/description";
import { currentDoc, findTitleAnchor } from "../content/sites/gdocs";

export default defineContentScript({
  matches: ["https://docs.google.com/document/*"],
  runAt: "document_idle",
  main(ctx) {
    let widget: Widget | null = null;
    let mode: "inline" | "floating" | null = null;

    function ensureWidget(next: "inline" | "floating", anchor: HTMLElement | null) {
      if (widget && mode === next && widget.host.isConnected) return widget;
      widget?.destroy();
      mode = next;
      widget =
        next === "inline"
          ? createWidget({ placement: "below" })
          : createWidget({ placement: "above", floating: true });
      if (next === "inline" && anchor) {
        widget.host.style.marginRight = "8px";
        widget.host.style.alignSelf = "center";
        anchor.insertAdjacentElement("afterend", widget.host);
      } else {
        document.body.append(widget.host);
      }
      return widget;
    }

    function scan() {
      const doc = currentDoc();
      if (!doc) {
        widget?.destroy();
        widget = null;
        mode = null;
        return;
      }
      const anchor = findTitleAnchor();
      const w = ensureWidget(anchor ? "inline" : "floating", anchor);
      w.setItem({
        source: "GOOGLE_DOCS",
        externalId: doc.docId,
        title: doc.title,
        description: describeGoogleDoc(doc),
        context: { key: `gdocs:${doc.docId}`, label: "this document" },
      });
    }

    watchPage(ctx, scan, { throttleMs: 1000 });
    ctx.onInvalidated(() => widget?.destroy());
  },
});
