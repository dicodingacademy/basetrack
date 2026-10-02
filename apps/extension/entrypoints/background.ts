import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import * as api from "../lib/api";
import { BASETRACK_URL, PROJECTS_TTL_MS } from "../lib/config";
import { elapsedSec, fmtBadge } from "../lib/format";
import { createPkcePair, randomString } from "../lib/pkce";
import {
  getAuth,
  getContexts,
  getMappings,
  getProjectsCache,
  getTimer,
  KEYS,
  onStorageChange,
  setAuth,
  setContexts,
  setMappings,
  setProjectsCache,
  setTimer,
} from "../lib/storage";
import type {
  Message,
  ProjectsResponse,
  SimpleResponse,
  StartRequest,
  StartResponse,
  StateResponse,
} from "../lib/types";

const REFRESH_ALARM = "basetrack-refresh";
const TAB_REFRESH_THROTTLE_MS = 15_000;

export default defineBackground(() => {
  let lastRefreshAt = 0;

  // ── state ────────────────────────────────────────────────────────────────

  async function refreshState(): Promise<void> {
    lastRefreshAt = Date.now();
    if (!(await getAuth())) {
      await updateBadge();
      return;
    }
    const res = await api.fetchMe();
    if (res.ok) {
      const auth = await getAuth();
      if (auth) await setAuth({ ...auth, user: res.data.user });
      await setTimer({ activeTimer: res.data.activeTimer, fetchedAt: Date.now() });
    }
    await updateBadge();
  }

  async function getState(): Promise<StateResponse> {
    const [auth, timer] = await Promise.all([getAuth(), getTimer()]);
    return { connected: !!auth, user: auth?.user ?? null, activeTimer: auth ? timer.activeTimer : null };
  }

  async function updateBadge(): Promise<void> {
    const { activeTimer } = await getState();
    await browser.action.setBadgeBackgroundColor({ color: "#f4813f" });
    await browser.action.setBadgeText({ text: activeTimer ? fmtBadge(elapsedSec(activeTimer.startedAt)) : "" });
    await browser.action.setTitle({
      title: activeTimer ? `Basetrack — ${activeTimer.todoTitle}` : "Basetrack",
    });
  }

  // ── auth ─────────────────────────────────────────────────────────────────

  async function connect(): Promise<SimpleResponse> {
    const redirectUri = browser.identity.getRedirectURL();
    const state = randomString(16);
    const { verifier, challenge } = await createPkcePair();
    const clientName = `Basetrack Extension (${import.meta.env.BROWSER === "firefox" ? "Firefox" : "Chrome"})`;

    const url = new URL(`${BASETRACK_URL}/extension/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("client_name", clientName);

    let resultUrl: string | undefined;
    try {
      resultUrl = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
    } catch (e) {
      return { ok: false, status: 0, error: "auth_cancelled", message: (e as Error)?.message || "Sign-in was cancelled" };
    }
    if (!resultUrl) return { ok: false, status: 0, error: "auth_cancelled", message: "Sign-in was cancelled" };

    const params = new URL(resultUrl).searchParams;
    if (params.get("state") !== state) {
      return { ok: false, status: 0, error: "invalid_state", message: "State mismatch — please try again" };
    }
    const error = params.get("error");
    if (error) return { ok: false, status: 0, error, message: error === "access_denied" ? "Access was denied" : error };
    const code = params.get("code");
    if (!code) return { ok: false, status: 0, error: "invalid_response", message: "No authorization code returned" };

    const token = await api.exchangeCode(code, verifier, redirectUri);
    if (!token.ok) return token;

    await setAuth({ token: token.data.access_token, user: token.data.user });
    await setProjectsCache(null);
    await refreshState();
    return { ok: true };
  }

  async function disconnect(): Promise<SimpleResponse> {
    if (await getAuth()) await api.logout(); // best effort; token is dropped either way
    await setAuth(null);
    await setTimer({ activeTimer: null, fetchedAt: Date.now() });
    await setProjectsCache(null);
    await updateBadge();
    return { ok: true };
  }

  // ── projects ─────────────────────────────────────────────────────────────

  async function getProjects(force = false): Promise<ProjectsResponse> {
    const cache = await getProjectsCache();
    if (!force && cache && Date.now() - cache.fetchedAt < PROJECTS_TTL_MS) {
      return { ok: true, projects: cache.projects };
    }
    const res = await api.fetchProjects();
    if (!res.ok) {
      // Stale data beats an empty picker when Basecamp is slow or down.
      if (cache && res.status !== 401) return { ok: true, projects: cache.projects };
      return res;
    }
    const projects = [...res.data.projects].sort((a, b) => a.name.localeCompare(b.name));
    await setProjectsCache({ projects, fetchedAt: Date.now() });
    return { ok: true, projects };
  }

  // ── timer ────────────────────────────────────────────────────────────────

  async function start({ item, project, remember }: StartRequest): Promise<StartResponse> {
    const res = await api.startTimer({
      source: item.source,
      externalId: item.externalId.slice(0, 255),
      title: item.title.slice(0, 255),
      description: item.description?.slice(0, 2000),
      projectId: project.id,
      projectName: project.name,
    });

    if (!res.ok) {
      if (res.status !== 401) await refreshState();
      return res;
    }

    await setTimer({ activeTimer: res.data.activeTimer, fetchedAt: Date.now() });

    const contexts = await getContexts();
    contexts[item.context.key] = {
      key: item.context.key,
      label: item.context.label,
      source: item.source,
      lastSeen: Date.now(),
    };
    await setContexts(contexts);

    if (remember) {
      const mappings = await getMappings();
      mappings.contexts[item.context.key] = project;
      await setMappings(mappings);
    }

    await updateBadge();
    return { ok: true, activeTimer: res.data.activeTimer, switchedFrom: res.data.switchedFrom };
  }

  async function stop(): Promise<SimpleResponse> {
    const res = await api.stopTimer();
    if (!res.ok) {
      if (res.status !== 401) await refreshState();
      return res;
    }
    await setTimer({ activeTimer: null, fetchedAt: Date.now() });
    await updateBadge();
    return { ok: true };
  }

  // ── wiring ───────────────────────────────────────────────────────────────

  async function handle(message: Message): Promise<unknown> {
    switch (message.type) {
      case "getState":
        return getState();
      case "connect":
        return connect();
      case "disconnect":
        return disconnect();
      case "refresh":
        await refreshState();
        return getState();
      case "getProjects":
        return getProjects(message.force);
      case "start":
        return start(message.request);
      case "stop":
        return stop();
      case "openOptions":
        await browser.runtime.openOptionsPage();
        return { ok: true };
    }
  }

  // sendResponse + `return true` works in both Chrome and Firefox without a polyfill.
  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((e: unknown) =>
        sendResponse({ ok: false, status: 0, error: "internal", message: (e as Error)?.message ?? String(e) }),
      );
    return true;
  });

  browser.alarms.create(REFRESH_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM) void refreshState();
  });

  browser.tabs.onActivated.addListener(() => {
    if (Date.now() - lastRefreshAt > TAB_REFRESH_THROTTLE_MS) void refreshState();
  });

  browser.runtime.onStartup.addListener(() => void refreshState());
  browser.runtime.onInstalled.addListener(() => void refreshState());

  onStorageChange([KEYS.timer, KEYS.auth], () => void updateBadge());
});
