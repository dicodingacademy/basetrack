import { SITE_ORIGINS } from "./sites";

export const BASETRACK_URL = (import.meta.env.WXT_BASETRACK_URL || "http://localhost:5173").replace(/\/+$/, "");

export const BASETRACK_ORIGIN = `${new URL(BASETRACK_URL).origin}/*`;

/** Origins Firefox MV3 may leave ungranted until the user approves them. */
export const REQUIRED_ORIGINS = [BASETRACK_ORIGIN, ...SITE_ORIGINS];

export const PROJECTS_TTL_MS = 5 * 60 * 1000;
