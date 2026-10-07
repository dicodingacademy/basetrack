import { useState, useEffect } from "react";
import { Outlet, NavLink, redirect, useLocation, Form } from "react-router";
import { randomUUID } from "node:crypto";

import type { Route } from "./+types/dashboard";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { getActiveTimer } from "../services/timer.server";
import { prisma } from "../utils/db.server";
import { cn } from "../lib/utils";
import { fmtTime } from "../lib/format";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../components/ui/sidebar";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { TimerPanel } from "../components/home/TimerPanel";
import { useLiveTimer } from "../hooks/useLiveTimer";
import { useTimerTitle } from "../hooks/useTimerTitle";
import { LayoutDashboard, History, Plug, Settings, LogOut } from "lucide-react";

export type DashboardContext = { activeTimer: ReturnType<typeof useLiveTimer>["activeTimer"] };

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/history", label: "History", icon: History, end: false },
  { to: "/dashboard/clients", label: "Clients", icon: Plug, end: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, end: false },
];

export function meta() {
  return [{ title: "Basetrack - Monitoring" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const sessionId = session.get("sessionId");
  if (!sessionId) return redirect("/auth/basecamp");

  let user = await getUserFromSessionId(sessionId);
  if (!user) return redirect("/auth/basecamp");

  if (!user.apiKey) {
    await prisma.user.update({ where: { id: user.id }, data: { apiKey: randomUUID() } });
    user = await getUserFromSessionId(sessionId);
  }
  if (!user) return redirect("/auth/basecamp");

  const activeTimer = await getActiveTimer(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, timezone: user.timezone, apiKey: user.apiKey },
    activeTimer,
    wsUrl: process.env.WS_PUBLIC_URL || "ws://localhost:8081",
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user, activeTimer: serverActiveTimer, wsUrl } = loaderData;
  const location = useLocation();
  const { activeTimer } = useLiveTimer(user.apiKey, wsUrl, serverActiveTimer);
  const [elapsed, setElapsed] = useState(0);
  useTimerTitle(activeTimer);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const start = new Date(activeTimer.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeTimer?.startedAt]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const current = NAV.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-[13px] tracking-tight shrink-0">
                  BT
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Basetrack</span>
                  <span className="truncate text-xs text-muted-foreground">Monitoring</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <NavLink to={item.to} end={item.end}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Avatar className="size-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Form method="post" action="/auth/logout">
                <SidebarMenuButton type="submit" tooltip="Sign out">
                  <LogOut className="size-4 shrink-0" />
                  <span className="truncate">Sign out</span>
                </SidebarMenuButton>
              </Form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-semibold">{current?.label ?? "Dashboard"}</span>
          <div className="w-px h-4 bg-border" />
          <span className="font-mono text-xs text-muted-foreground">{today}</span>
          <div className={cn(
            "ml-auto flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-all",
            activeTimer
              ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(244,129,63,.3)]"
              : "border-border bg-card text-muted-foreground"
          )}>
            <span className={cn("size-1.5 rounded-full shrink-0", activeTimer ? "bg-primary animate-live-pulse" : "bg-muted-foreground")} />
            {activeTimer ? fmtTime(elapsed) : "No timer"}
          </div>
        </header>

        <div className="flex flex-1 items-start">
          <div className="flex-1 p-6">
            <Outlet context={{ activeTimer } satisfies DashboardContext} />
          </div>
          <div className="sticky top-13 h-[calc(100vh-52px)] shrink-0">
            <TimerPanel activeTimer={activeTimer} elapsed={elapsed} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
