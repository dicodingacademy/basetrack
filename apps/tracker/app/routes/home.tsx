import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { getActiveTimer } from "../services/timer.server";
import { LandingPage } from "../components/landing/LandingPage";

export function meta() {
  return [
    { title: "Basetrack - Basecamp Time Tracker" },
    { name: "description", content: "Monitor Basecamp time tracking from the browser extension and desktop app." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));

  if (!user) return { user: null, activeTimer: null };
  if (!url.searchParams.has("landing")) return redirect("/dashboard");

  return { user: { name: user.name }, activeTimer: await getActiveTimer(user.id) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <LandingPage activeTimer={loaderData.activeTimer} isLoggedIn={!!loaderData.user} />;
}
