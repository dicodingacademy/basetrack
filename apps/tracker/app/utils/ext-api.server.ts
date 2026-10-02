import { data } from "react-router";
import { authenticateExtension } from "../services/extension-auth.server";

// Extension endpoints authenticate with a bearer token, never cookies, so allowing any origin is safe.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "600",
};

export function extJson<T>(body: T, status = 200) {
  return data(body, { status, headers: CORS_HEADERS });
}

export function extError(status: number, error: string, message?: string) {
  return extJson({ error, message: message ?? error }, status);
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** React Router sends OPTIONS to the loader, so POST-only routes export this to answer CORS preflights. */
export function preflightLoader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") return preflight();
  return extError(405, "method_not_allowed");
}

export async function requireExtensionUser(request: Request) {
  const auth = await authenticateExtension(request);
  if (!auth) throw extError(401, "unauthorized", "Extension token is missing, invalid or revoked");
  return auth;
}
