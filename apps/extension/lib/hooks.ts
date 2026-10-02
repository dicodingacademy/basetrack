import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { REQUIRED_ORIGINS } from "./config";
import { send } from "./messages";
import { getAuth, getTimer, KEYS, onStorageChange } from "./storage";
import type { ActiveTimer, Project, User } from "./types";

export function useExtensionState() {
  const [state, setState] = useState<{ loaded: boolean; user: User | null; activeTimer: ActiveTimer | null }>({
    loaded: false,
    user: null,
    activeTimer: null,
  });

  useEffect(() => {
    const load = async () => {
      const [auth, timer] = await Promise.all([getAuth(), getTimer()]);
      setState({ loaded: true, user: auth?.user ?? null, activeTimer: auth ? timer.activeTimer : null });
    };
    void load();
    void send({ type: "refresh" }); // storage listener picks up the result
    return onStorageChange([KEYS.auth, KEYS.timer], () => void load());
  }, []);

  return state;
}

export function useNow(enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [enabled]);
  return now;
}

export function useProjects(enabled: boolean) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    const res = await send({ type: "getProjects", force });
    if (res.ok) setProjects(res.projects);
    else setError(res.message);
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { projects, error, reload: () => load(true) };
}

/** Firefox MV3 treats host permissions as optional; they may need an explicit grant. */
export function useHostPermissions() {
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    void browser.permissions.contains({ origins: REQUIRED_ORIGINS }).then(setGranted);
  }, []);

  const request = async () => {
    // Must run directly in a click handler (user gesture).
    const ok = await browser.permissions.request({ origins: REQUIRED_ORIGINS });
    setGranted(ok);
  };

  return { granted, request };
}
