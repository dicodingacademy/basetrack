import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/check-timesheet", "routes/api.check-timesheet.tsx"),
  route("api/project-tasks", "routes/api.project-tasks.tsx"),
  route("api/time-entries", "routes/api.time-entries.tsx"),
  route("api/time-entries/retry", "routes/api.time-entries.retry.tsx"),
  route("auth/basecamp", "routes/auth.basecamp.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("auth/:provider", "routes/auth.$provider.tsx"),
  route("auth/:provider/callback", "routes/auth.$provider.callback.tsx"),
] satisfies RouteConfig;
