import type { ContentScriptContext } from "wxt/utils/content-script-context";

export function watchPage(ctx: ContentScriptContext, scan: () => void, { throttleMs = 250, urlPollMs = 500 } = {}) {
  let lastRun = 0;
  let pending: ReturnType<typeof ctx.setTimeout> | undefined;

  const schedule = () => {
    const elapsed = Date.now() - lastRun;
    if (elapsed >= throttleMs) {
      lastRun = Date.now();
      scan();
      return;
    }
    if (pending !== undefined) return;
    pending = ctx.setTimeout(() => {
      pending = undefined;
      lastRun = Date.now();
      scan();
    }, throttleMs - elapsed);
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
