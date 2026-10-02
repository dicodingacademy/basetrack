import { browser } from "wxt/browser";
import type { AuthState, Mappings, Project, Source, TimerState, TrackingContext } from "./types";

// storage.local: auth, timer, projects cache, learned contexts (per browser)
// storage.sync:  project mappings (follow the user's browser profile)

export const KEYS = {
  auth: "auth",
  timer: "timer",
  projects: "projects",
  contexts: "contexts",
  mappings: "mappings",
} as const;

type ProjectsCache = { projects: Project[]; fetchedAt: number };

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const res = await browser.storage.local.get(key);
  return (res[key] as T | undefined) ?? fallback;
}

export const getAuth = () => getLocal<AuthState>(KEYS.auth, null);
export const setAuth = (auth: AuthState) => browser.storage.local.set({ [KEYS.auth]: auth });

export const getTimer = () => getLocal<TimerState>(KEYS.timer, { activeTimer: null, fetchedAt: 0 });
export const setTimer = (timer: TimerState) => browser.storage.local.set({ [KEYS.timer]: timer });

export const getProjectsCache = () => getLocal<ProjectsCache | null>(KEYS.projects, null);
export const setProjectsCache = (cache: ProjectsCache | null) => browser.storage.local.set({ [KEYS.projects]: cache });

export const getContexts = () => getLocal<Record<string, TrackingContext>>(KEYS.contexts, {});
export const setContexts = (contexts: Record<string, TrackingContext>) =>
  browser.storage.local.set({ [KEYS.contexts]: contexts });

const EMPTY_MAPPINGS: Mappings = { defaults: {}, contexts: {} };

export async function getMappings(): Promise<Mappings> {
  const res = await browser.storage.sync.get(KEYS.mappings);
  const m = res[KEYS.mappings] as Mappings | undefined;
  return { defaults: m?.defaults ?? {}, contexts: m?.contexts ?? {} };
}

export const setMappings = (mappings: Mappings = EMPTY_MAPPINGS) =>
  browser.storage.sync.set({ [KEYS.mappings]: mappings });

/** Context mapping wins over the per-source default. */
export function resolveProject(mappings: Mappings, source: Source, contextKey: string): Project | null {
  return mappings.contexts[contextKey] ?? mappings.defaults[source] ?? null;
}

/** Calls `cb` whenever one of `keys` changes in local or sync storage. */
export function onStorageChange(keys: string[], cb: () => void): () => void {
  const listener = (changes: Record<string, unknown>) => {
    if (keys.some((k) => k in changes)) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
