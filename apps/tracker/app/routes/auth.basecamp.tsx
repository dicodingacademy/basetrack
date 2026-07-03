import { redirect } from "react-router";
import { getAuthorizationUrl } from "../utils/basecamp.server";
import type { Route } from "./+types/auth.basecamp";

export async function loader({ request }: Route.LoaderArgs) {
  const url = getAuthorizationUrl();
  return redirect(url);
}
