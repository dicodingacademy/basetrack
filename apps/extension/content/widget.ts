import { elapsedSec, fmtClock, fmtDuration } from "../lib/format";
import { send } from "../lib/messages";
import { getAuth, getMappings, getTimer, KEYS, onStorageChange, resolveProject } from "../lib/storage";
import type { ActiveTimer, ItemInfo, Mappings, Project } from "../lib/types";
import { WIDGET_CSS } from "./widget.css";

/**
 * Preferred side for the project picker. The picker is `position: fixed` and
 * flips automatically when there isn't room, so it is never clipped by the
 * page's own scroll containers. "flow" is kept as an alias of "below".
 */
export type Placement = "flow" | "below" | "above";

export type Widget = {
  host: HTMLElement;
  setItem(item: ItemInfo | null): void;
  destroy(): void;
};

// Events that would otherwise bubble out of the shadow root and trigger page
// shortcuts or "click outside" handlers (e.g. GitHub closing its side pane).
const ISOLATED_EVENTS = ["keydown", "keyup", "keypress", "mousedown", "mouseup", "pointerdown", "pointerup", "click"];

const PANEL_WIDTH = 300;
const GAP = 6;
const MARGIN = 8;

const isRunning = (timer: ActiveTimer | null, item: ItemInfo | null) =>
  !!timer && !!item && timer.source === item.source && timer.todoId === item.externalId;

const ICON_PLAY = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/></svg>`;
const ICON_CARET = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.5 8 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_REFRESH = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.46-3.54M13 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Picks light/dark from the page itself (Calendar/GitHub/Docs have their own themes, independent of the OS). */
function detectTheme(from: Element): "light" | "dark" {
  for (let el: Element | null = from; el; el = el.parentElement) {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!m) continue;
    if (m[4] !== undefined && Number(m[4]) < 0.5) continue;
    const luminance = 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
    return luminance < 128 ? "dark" : "light";
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

export function createWidget({ placement, floating = false }: { placement: Placement; floating?: boolean }): Widget {
  const side: "below" | "above" = placement === "above" ? "above" : "below";
  const host = document.createElement("basetrack-timer");
  host.style.cssText = floating
    ? "position:fixed;right:20px;bottom:20px;z-index:2147483646;"
    : "display:inline-flex;align-items:center;vertical-align:middle;margin:0 4px;";
  for (const type of ISOLATED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>${WIDGET_CSS}</style>
    <div class="bt${floating ? " floating" : ""}" hidden>
      <div class="bar">
        <button class="main" type="button"><span class="ic"></span><span class="label"></span></button>
        <button class="caret" type="button" title="Choose another project" aria-label="Choose another project">${ICON_CARET}</button>
      </div>
      <div class="toast" role="status" hidden></div>
      <div class="panel" role="dialog" aria-label="Choose a Basecamp project" hidden>
        <div class="panel-head">
          <div class="panel-title">Track in Basecamp project</div>
          <div class="panel-item"></div>
        </div>
        <label class="search-wrap">${ICON_SEARCH}<input class="search" type="text" placeholder="Search projects" autocomplete="off" spellcheck="false" /></label>
        <div class="note" hidden></div>
        <div class="list" role="listbox"></div>
        <div class="err" hidden></div>
        <div class="foot">
          <label class="remember"><input type="checkbox" /><span></span></label>
          <button class="icon-btn refresh" type="button" title="Refresh projects" aria-label="Refresh projects">${ICON_REFRESH}</button>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => shadow.querySelector(sel) as T;
  const root = $<HTMLDivElement>(".bt");
  const bar = $<HTMLDivElement>(".bar");
  const mainBtn = $<HTMLButtonElement>(".main");
  const mainIcon = $<HTMLSpanElement>(".main .ic");
  const mainLabel = $<HTMLSpanElement>(".main .label");
  const caretBtn = $<HTMLButtonElement>(".caret");
  const toast = $<HTMLDivElement>(".toast");
  const panel = $<HTMLDivElement>(".panel");
  const panelItem = $<HTMLDivElement>(".panel-item");
  const search = $<HTMLInputElement>(".search");
  const note = $<HTMLDivElement>(".note");
  const list = $<HTMLDivElement>(".list");
  const panelErr = $<HTMLDivElement>(".err");
  const rememberBox = $<HTMLInputElement>(".remember input");
  const rememberLabel = $<HTMLSpanElement>(".remember span");
  const refreshBtn = $<HTMLButtonElement>(".refresh");

  let item: ItemInfo | null = null;
  let connected = false;
  let timer: ActiveTimer | null = null;
  let mappings: Mappings = { defaults: {}, contexts: {} };
  let projects: Project[] | null = null;
  let projectsError: string | null = null;
  let matches: Project[] = [];
  let activeIndex = 0;
  let busy = false;
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;

  const resolved = () => (item ? resolveProject(mappings, item.source, item.context.key) : null);
  const isOpen = () => !panel.hidden;

  /** Places a fixed-position element next to the button, flipping sides and clamping to the viewport. */
  function anchor(el: HTMLElement, width: number) {
    const r = bar.getBoundingClientRect();
    el.style.width = `${width}px`;
    el.style.left = "0px";
    el.style.top = "0px";
    const h = el.offsetHeight;
    const roomBelow = innerHeight - r.bottom - GAP - MARGIN;
    const roomAbove = r.top - GAP - MARGIN;
    const goBelow = side === "below" ? roomBelow >= h || roomBelow >= roomAbove : !(roomAbove >= h || roomAbove >= roomBelow);
    const top = goBelow ? r.bottom + GAP : r.top - GAP - h;
    const left = Math.min(Math.max(r.right - width, MARGIN), innerWidth - width - MARGIN);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(MARGIN, top)}px`;
    // A transformed ancestor turns `fixed` into `absolute`; measure and correct the offset.
    const actual = el.getBoundingClientRect();
    el.style.left = `${left - (actual.left - left)}px`;
    el.style.top = `${Math.max(MARGIN, top) - (actual.top - Math.max(MARGIN, top))}px`;
  }

  function reposition() {
    if (isOpen()) anchor(panel, PANEL_WIDTH);
    if (!toast.hidden) anchor(toast, Math.min(PANEL_WIDTH, 280));
  }

  function showToast(message: string, kind: "info" | "error" = "info") {
    toast.textContent = message;
    toast.className = `toast ${kind}`;
    toast.hidden = false;
    anchor(toast, Math.min(PANEL_WIDTH, 280));
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => (toast.hidden = true), kind === "error" ? 8000 : 5000);
  }

  function setIcon(svg: string) {
    if (mainIcon.dataset.icon !== svg) {
      mainIcon.innerHTML = svg;
      mainIcon.dataset.icon = svg;
    }
  }

  function render() {
    root.hidden = !item;
    if (!item) return;

    const running = isRunning(timer, item);
    const project = resolved();
    mainBtn.disabled = busy;
    caretBtn.disabled = busy;
    mainBtn.className = "main";
    caretBtn.hidden = true;

    if (!connected) {
      mainBtn.classList.add("neutral");
      setIcon("");
      mainLabel.textContent = busy ? "Connecting…" : "Connect Basetrack";
      mainBtn.title = "Connect this browser to Basetrack";
    } else if (running && timer) {
      mainBtn.classList.add("stop");
      setIcon(ICON_STOP);
      mainLabel.textContent = fmtClock(elapsedSec(timer.startedAt));
      mainBtn.title = `Stop · ${timer.todoTitle} (${timer.projectName})`;
    } else if (project) {
      setIcon(ICON_PLAY);
      mainLabel.textContent = project.name;
      mainBtn.title = timer
        ? `Start in ${project.name} — switches from “${timer.todoTitle}”`
        : `Start tracking in ${project.name}`;
      caretBtn.hidden = false;
    } else {
      setIcon(ICON_PLAY);
      mainLabel.textContent = "Start";
      mainBtn.title = timer ? `Start — switches from “${timer.todoTitle}”` : "Choose a Basecamp project and start tracking";
    }
    bar.classList.toggle("split", !caretBtn.hidden);
    if (!connected || running) closePicker();

    if (running && !tick) tick = setInterval(render, 1000);
    if (!running && tick) {
      clearInterval(tick);
      tick = undefined;
    }
  }

  function emptyRow(text: string) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = text;
    list.replaceChildren(div);
  }

  function highlight(index: number) {
    const rows = list.querySelectorAll<HTMLButtonElement>(".item");
    if (rows.length === 0) return;
    activeIndex = (index + rows.length) % rows.length;
    rows.forEach((row, i) => row.classList.toggle("active", i === activeIndex));
    rows[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function renderList() {
    if (projectsError) return emptyRow(projectsError);
    if (!projects) return emptyRow("Loading projects…");
    const q = search.value.trim().toLowerCase();
    const mapped = resolved()?.id;
    matches = projects.filter((p) => p.name.toLowerCase().includes(q));
    // Keep the mapped project on top when not searching, so Enter picks it.
    if (!q && mapped) matches.sort((a, b) => Number(b.id === mapped) - Number(a.id === mapped));
    if (matches.length === 0) return emptyRow("No matching projects");

    list.replaceChildren(
      ...matches.map((p, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.setAttribute("role", "option");
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = initials(p.name);
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = p.name;
        btn.append(badge, name);
        if (p.id === mapped) {
          const check = document.createElement("span");
          check.className = "check";
          check.innerHTML = ICON_CHECK;
          btn.append(check);
        }
        btn.addEventListener("mouseenter", () => highlight(i));
        btn.addEventListener("click", () => void start(p, rememberBox.checked));
        return btn;
      }),
    );
    highlight(0);
  }

  async function loadProjects(force = false) {
    projects = null;
    projectsError = null;
    renderList();
    const res = await send({ type: "getProjects", force });
    if (res.ok) projects = res.projects;
    else projectsError = res.message;
    renderList();
    reposition();
  }

  function openPicker() {
    if (!item) return;
    root.dataset.theme = detectTheme(host.parentElement ?? document.body);
    toast.hidden = true;
    panelErr.hidden = true;
    panel.hidden = false;
    panelItem.textContent = item.title;
    search.value = "";
    note.textContent = timer && !isRunning(timer, item) ? `Switches from “${timer.todoTitle}”` : "";
    note.hidden = !note.textContent;
    rememberBox.checked = !mappings.contexts[item.context.key];
    rememberLabel.textContent = `Remember for ${item.context.label}`;
    anchor(panel, PANEL_WIDTH);
    void loadProjects();
    setTimeout(() => search.focus(), 0);
  }

  function closePicker() {
    panel.hidden = true;
  }

  async function run(action: () => Promise<void>) {
    busy = true;
    render();
    try {
      await action();
    } catch (e) {
      showToast((e as Error)?.message ?? "Something went wrong", "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function start(project: Project, remember: boolean) {
    if (!item) return;
    const current = item;
    await run(async () => {
      const res = await send({ type: "start", request: { item: current, project, remember } });
      if (!res.ok) {
        if (isOpen()) {
          panelErr.textContent = res.message;
          panelErr.hidden = false;
        } else {
          showToast(res.message, "error");
        }
        return;
      }
      closePicker();
      timer = res.activeTimer;
      showToast(
        res.switchedFrom
          ? `Switched from “${res.switchedFrom.todoTitle}” · ${fmtDuration(res.switchedFrom.durationSec)} saved`
          : `Tracking in ${project.name}`,
      );
    });
  }

  mainBtn.addEventListener("click", () => {
    if (!item) return;
    root.dataset.theme = detectTheme(host.parentElement ?? document.body);
    if (!connected) {
      void run(async () => {
        const res = await send({ type: "connect" });
        if (!res.ok) showToast(res.message, "error");
      });
      return;
    }
    if (isRunning(timer, item)) {
      void run(async () => {
        const res = await send({ type: "stop" });
        if (!res.ok) showToast(res.message, "error");
        else timer = null;
      });
      return;
    }
    const project = resolved();
    if (project) void start(project, false);
    else if (isOpen()) closePicker();
    else openPicker();
  });

  caretBtn.addEventListener("click", () => (isOpen() ? closePicker() : openPicker()));
  search.addEventListener("input", renderList);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePicker();
    else if (e.key === "ArrowDown") highlight(activeIndex + 1);
    else if (e.key === "ArrowUp") highlight(activeIndex - 1);
    else if (e.key === "Enter") list.querySelectorAll<HTMLButtonElement>(".item")[activeIndex]?.click();
    else return;
    e.preventDefault();
  });
  refreshBtn.addEventListener("click", () => void loadProjects(true));

  // Google Calendar cancels wheel events at the document level, so scroll the list ourselves.
  list.addEventListener(
    "wheel",
    (e) => {
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? list.clientHeight : 1;
      list.scrollTop += e.deltaY * unit;
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false },
  );
  // Keep wheel/touch scrolling inside the picker from reaching the page.
  for (const type of ["wheel", "touchmove"]) panel.addEventListener(type, (e) => e.stopPropagation(), { passive: true });

  const onOutside = (e: Event) => {
    if (isOpen() && !e.composedPath().includes(host)) closePicker();
  };
  const onViewportChange = () => reposition();
  document.addEventListener("pointerdown", onOutside, true);
  addEventListener("resize", onViewportChange);
  addEventListener("scroll", onViewportChange, true);

  async function syncFromStorage() {
    const [auth, t, m] = await Promise.all([getAuth(), getTimer(), getMappings()]);
    connected = !!auth;
    timer = auth ? t.activeTimer : null;
    mappings = m;
    render();
  }

  const unsubscribe = onStorageChange([KEYS.auth, KEYS.timer, KEYS.mappings], () => void syncFromStorage());
  void syncFromStorage();
  queueMicrotask(() => (root.dataset.theme = detectTheme(host.parentElement ?? document.body)));

  return {
    host,
    setItem(next) {
      const changed = next?.source !== item?.source || next?.externalId !== item?.externalId;
      item = next;
      if (changed) {
        closePicker();
        toast.hidden = true;
      }
      render();
    },
    destroy() {
      unsubscribe();
      clearInterval(tick);
      clearTimeout(toastTimeout);
      document.removeEventListener("pointerdown", onOutside, true);
      removeEventListener("resize", onViewportChange);
      removeEventListener("scroll", onViewportChange, true);
      host.remove();
    },
  };
}
