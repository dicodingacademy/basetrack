import { BASETRACK_URL } from "./config";
import { getAuth, setAuth, setTimer } from "./storage";
import type { ActiveTimer, ApiError, Project, Source, User } from "./types";

// Background-only: content scripts can't call Basetrack directly because MV3
// content-script fetches are subject to the page's CORS policy.

type Ok<T> = { ok: true; data: T };

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<Ok<T> | ApiError> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASETRACK_URL}${path}`, { ...init, headers });
  } catch {
    return { ok: false, status: 0, error: "network", message: `Cannot reach Basetrack at ${BASETRACK_URL}` };
  }

  const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (res.ok && body) return { ok: true, data: body };

  if (res.status === 401 && token) {
    // Token revoked or expired: forget it so the UI offers "Connect" again.
    await setAuth(null);
    await setTimer({ activeTimer: null, fetchedAt: Date.now() });
  }

  return {
    ok: false,
    status: res.status,
    error: body?.error ?? "http_error",
    message: body?.message ?? `Basetrack responded with ${res.status}`,
  };
}

async function authed<T>(path: string, init?: RequestInit): Promise<Ok<T> | ApiError> {
  const auth = await getAuth();
  if (!auth) return { ok: false, status: 401, error: "unauthorized", message: "Not connected to Basetrack" };
  return request<T>(path, init, auth.token);
}

export function exchangeCode(code: string, codeVerifier: string, redirectUri: string) {
  return request<{ access_token: string; token_type: string; user: User }>("/api/extension/token", {
    method: "POST",
    body: JSON.stringify({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
  });
}

export const fetchMe = () => authed<{ user: User; activeTimer: ActiveTimer | null }>("/api/ext/me");

export const fetchProjects = () => authed<{ projects: Project[] }>("/api/ext/projects");

export const startTimer = (body: {
  source: Source;
  externalId: string;
  title: string;
  description?: string;
  projectId: string;
  projectName: string;
}) =>
  authed<{ activeTimer: ActiveTimer; switchedFrom: { todoTitle: string; durationSec: number } | null }>(
    "/api/ext/timer/start",
    { method: "POST", body: JSON.stringify(body) },
  );

export const stopTimer = () => authed<{ stopped: boolean }>("/api/ext/timer/stop", { method: "POST" });

export const logout = () => authed<{ ok: true }>("/api/ext/logout", { method: "POST" });
