import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/basecamp", "routes/auth.basecamp.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("api/internal/stop", "routes/api.internal.stop.tsx"),
] satisfies RouteConfig;
