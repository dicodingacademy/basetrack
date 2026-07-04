import type { ActionFunctionArgs } from "react-router";
import { stopTimer } from "../services/timer.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const internalKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";
  const providedKey = request.headers.get("x-internal-key");

  if (providedKey !== internalKey) {
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
