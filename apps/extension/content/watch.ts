import type { ContentScriptContext } from "wxt/utils/content-script-context";

/**
 * Runs `scan` whenever the DOM changes (throttled) and whenever the URL
 * changes. SPA navigation (GitHub, Calendar) doesn't reload the content
 * script, and history events aren't observable from the isolated world, so a
 * cheap URL poll is the most reliable signal across Chrome and Firefox.
 */
export function watchPage(ctx: ContentScriptContext, scan: () => void, { throttleMs = 250, urlPollMs = 500 } = {}) {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    ctx.setTimeout(() => {
      scheduled = false;
      scan();
    }, throttleMs);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  ctx.onInvalidated(() => observer.disconnect());

  let lastUrl = location.href;
  ctx.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      schedule();
    }
  }, urlPollMs);

  scan();
}

export const textOf = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
