import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import { query } from "../content/dom";
import { currentProjectItem, GITHUB, type ProjectItem } from "../content/sites/github";
import { describeGithubItem } from "../lib/description";
import type { ItemInfo } from "../lib/types";

export default defineContentScript({
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main(ctx) {
    let widget: Widget | null = null;
    let mode: "inline" | "floating" | null = null;

    function ensure(next: "inline" | "floating"): Widget {
      if (widget && mode === next) return widget;
      widget?.destroy();
      mode = next;
      widget = createWidget({ placement: next === "inline" ? "below" : "above", floating: next === "floating" });
      return widget;
    }

    function toItem(item: ProjectItem): ItemInfo {
      return {
        source: "GITHUB_PROJECT",
        externalId: item.externalId,
        title: item.title,
        description: describeGithubItem({ title: item.issueTitle, url: item.url }),
        context: { key: `gh:${item.org}/${item.projectNumber}`, label: item.projectName },
      };
    }

    function scan() {
      const item = currentProjectItem();
      if (!item) {
        widget?.setItem(null);
        return;
      }

      const state = query<HTMLElement>(document, GITHUB.headerState);
      const slot = state?.parentElement ?? null;

      if (slot) {
        const w = ensure("inline");
        if (slot.nextElementSibling !== w.host) slot.insertAdjacentElement("afterend", w.host);
        w.setItem(toItem(item));
        return;
      }

      const w = ensure("floating");
      if (w.host.parentElement !== document.body) document.body.append(w.host);
      w.setItem(toItem(item));
    }

    watchPage(ctx, scan, { throttleMs: 400 });
    ctx.onInvalidated(() => widget?.destroy());
  },
});
