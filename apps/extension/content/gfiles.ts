import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "./widget";
import { watchPage } from "./watch";
import { currentEditorFile, findShareAnchor } from "./sites/geditors";
import { describeGoogleFile } from "../lib/description";
import type { GFileKind, Source } from "../lib/types";

type GFileOptions = {
  matches: string[];
  source: Source;
  kind: GFileKind;
  contextPrefix: string;
  contextLabel: string;
};

export function defineGFileContent({ matches, source, kind, contextPrefix, contextLabel }: GFileOptions) {
  return defineContentScript({
    matches,
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
            ? createWidget({ placement: "below", large: true })
            : createWidget({ placement: "above", floating: true });
        if (next === "inline" && anchor) {
          widget.host.style.marginRight = "8px";
          widget.host.style.alignSelf = "center";
          anchor.insertAdjacentElement("beforebegin", widget.host);
        } else {
          document.body.append(widget.host);
        }
        return widget;
      }

      function scan() {
        const file = currentEditorFile(kind);
        if (!file) {
          widget?.destroy();
          widget = null;
          mode = null;
          return;
        }
        const anchor = findShareAnchor();
        const w = ensureWidget(anchor ? "inline" : "floating", anchor);
        w.setItem({
          source,
          externalId: file.fileId,
          title: file.title,
          description: describeGoogleFile(kind, file),
          context: { key: `${contextPrefix}:${file.fileId}`, label: contextLabel },
        });
      }

      watchPage(ctx, scan, { throttleMs: 1000 });
      ctx.onInvalidated(() => widget?.destroy());
    },
  });
}
