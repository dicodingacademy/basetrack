import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import { currentProjectItem } from "../content/sites/github";
import { describeGithubItem } from "../lib/description";

export default defineContentScript({
  // All of github.com: navigating into a project is client-side, so the
  // script must already be loaded. It stays idle outside /orgs/*/projects/*.
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main(ctx) {
    let widget: Widget | null = null;

    function scan() {
      const item = currentProjectItem();
      if (!item) {
        widget?.setItem(null);
        return;
      }
      if (!widget) {
        widget = createWidget({ placement: "above", floating: true });
        document.body.append(widget.host);
      } else if (!widget.host.isConnected) {
        // Turbo navigations can replace <body>.
        document.body.append(widget.host);
      }
      widget.setItem({
        source: "GITHUB_PROJECT",
        externalId: item.externalId,
        title: item.title,
        description: describeGithubItem({ title: item.issueTitle, url: item.url }),
        context: { key: `gh:${item.org}/${item.projectNumber}`, label: item.projectName },
      });
    }

    watchPage(ctx, scan, { throttleMs: 400 });
    ctx.onInvalidated(() => widget?.destroy());
  },
});
