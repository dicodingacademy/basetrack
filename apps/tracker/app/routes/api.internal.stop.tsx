import type { ActionFunctionArgs } from "react-router";
import { stopTimer } from "../services/timer.server";
import { timingSafeEqual } from "node:crypto";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedInternalKey = process.env.INTERNAL_API_KEY;
  if (process.env.NODE_ENV === "production" && !expectedInternalKey) {
    throw new Error("INTERNAL_API_KEY must be set in production environment");
  }
  const internalKey = expectedInternalKey || "dev-internal-key-123";
  
  const providedKey = request.headers.get("x-internal-key");

  if (!providedKey || typeof providedKey !== "string" || providedKey.length !== internalKey.length || !timingSafeEqual(Buffer.from(providedKey), Buffer.from(internalKey))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await request.json();
  const { userId, basecampId } = data;

  if (!userId || !basecampId) {
    return new Response("Missing parameters", { status: 400 });
  }

  const result = await stopTimer(userId, basecampId);
  return Response.json(result);
}
