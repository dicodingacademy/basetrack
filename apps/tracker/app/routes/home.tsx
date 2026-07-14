import { useState, useEffect, Suspense } from "react";
import { Await } from "react-router";

import type { Route } from "./+types/home";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { fetchAssignments, getValidAccessToken } from "../utils/basecamp.server";
import { getActiveTimer, getPendingApprovals, approveTimeEntry } from "../services/timer.server";
import { generateNewApiKey } from "../services/user.server";
import { getRules, saveRule, deleteRule, updateUserTimezone, replaceAllRules } from "../services/rules.server";
import { prisma } from "../utils/db.server";
import { randomUUID } from "node:crypto";
import { registry } from "../integrations/registry";
import { disconnectProvider, getConnectedProviders } from "../integrations/token.server";
import type { TrackableItem } from "../integrations/types";

import { cn } from "../lib/utils";
import { fmtTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
} from "../components/ui/sidebar";

import { useTimerWebSocket } from "../hooks/useTimerWebSocket";
import { useTimerTitle } from "../hooks/useTimerTitle";
import { PendingApprovals } from "../components/home/PendingApprovals";
import { SettingsModal } from "../components/home/SettingsModal";
import { ContentSkeleton, EmptyState } from "../components/home/ContentSkeleton";
import { BasecampTaskCard } from "../components/home/EventCard";
import { TrackableItemCard } from "../components/home/TrackableItemCard";
import { TimerPanel } from "../components/home/TimerPanel";
import { HistoryPanel } from "../components/home/HistoryPanel";
import { LandingPage } from "../components/landing/LandingPage";

import {
  Briefcase,
  Calendar,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  History,
} from "lucide-react";

import type { BasecampAssignment, GroupedTask } from "../types/basecamp";
import type { Condition } from "../components/home/types";
import type { TimeEntry, Prisma } from "@prisma/client";

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  ListTodo,
};

type AppData = {
  projects: { id: string; name: string; taskCount: number }[];
  pendingApprovals: TimeEntry[];
  timesheetProjects: { id: string; name: string }[];
};

type TabState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; items: TrackableItem[] }
  | { status: "error" };

export function shouldRevalidate({ formAction }: { formAction?: string }) {
  if (formAction?.startsWith("/api/")) return false;
  return true;
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Basetrack - Basecamp Time Tracker" },
    { name: "description", content: "Track time on your Basecamp todos easily." },
  ];
}

async function loadData(
  user: NonNullable<Awaited<ReturnType<typeof getUserFromSessionId>>>,
): Promise<AppData> {
  let projects: { id: string; name: string; taskCount: number }[] = [];

  try {
    const accessToken = await getValidAccessToken(user.id);
    const rawAssignments = await fetchAssignments(user.basecampAccountId, accessToken);
    const items: BasecampAssignment[] = rawAssignments;
    const counts: Record<string, { name: string; count: number }> = {};
    for (const curr of items) {
      if (!curr.bucket) continue;
      if (curr.completed === true || curr.status === "archived" || curr.status === "trashed") continue;
      const id = curr.bucket.id.toString();
      if (!counts[id]) counts[id] = { name: curr.bucket.name, count: 0 };
      counts[id].count++;
    }
    projects = Object.entries(counts).map(([id, { name, count }]) => ({ id, name, taskCount: count }));
  } catch (err) {
    console.error("Fetch assignments failed", err);
  }

  const pendingApprovals = await getPendingApprovals(user.id);
  const timesheetProjects = projects.map(p => ({ id: p.id, name: p.name }));

  return { projects, pendingApprovals, timesheetProjects };
}

export async function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");

  if (!sessionId) return { user: null, activeTimer: null, googleConnected: false, data: null };

  let user = await getUserFromSessionId(sessionId);

  if (!user) return { user: null, activeTimer: null, googleConnected: false, data: null };

  if (!user.apiKey) {
    await prisma.user.update({ where: { id: user.id }, data: { apiKey: randomUUID() } });
    user = await getUserFromSessionId(sessionId);
  }

  const [activeTimer, rules, connectedProviderIds] = await Promise.all([
    getActiveTimer(user!.id),
    getRules(user!.id),
    getConnectedProviders(user!.id),
  ]);

  const providerGroups = connectedProviderIds.flatMap(id => {
    const p = registry[id];
    if (!p) return [];
    return [{
      providerId: id,
      providerLabel: p.label,
      tabs: p.tabs.map(tab => ({ tabId: tab.id, label: tab.label, iconName: tab.iconName })),
    }];
  });

  const availableProviders = Object.values(registry).map(p => ({
    id: p.id, label: p.label, scopes: p.scopes,
  }));

  return {
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      timezone: user!.timezone,
      apiKey: user!.apiKey,
    },
    connectedProviders: connectedProviderIds,
    providerGroups,
    availableProviders,
    activeTimer,
    rules: rules.map(r => ({ ...r, conditions: r.conditions as unknown as Condition[] })),
    wsUrl: process.env.WS_PUBLIC_URL || "ws://localhost:8081",
    data: loadData(user!),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");

  if (!sessionId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserFromSessionId(sessionId);
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (intent === "APPROVE_TIMER") {
    const entryId = formData.get("entryId") as string;
    const durationHours = parseFloat(formData.get("durationHours") as string);
    if (!entryId || !Number.isFinite(durationHours) || durationHours <= 0) return new Response("Invalid data", { status: 400 });
    return await approveTimeEntry(user.id, entryId, user.basecampAccountId, Math.round(durationHours * 3600), user.timezone);
  }

  if (intent === "SAVE_RULE") {
    const ruleId = formData.get("ruleId") as string;
    const name = formData.get("name") as string;
    const enabled = formData.get("enabled") === "true";
    const conditionsStr = formData.get("conditions") as string;
    if (!conditionsStr) return new Response("Missing conditions", { status: 400 });
    let conditions;
    try { conditions = JSON.parse(conditionsStr); } catch { return new Response("Invalid conditions JSON", { status: 400 }); }
    if (!Array.isArray(conditions) || conditions.length === 0) return new Response("At least one condition required", { status: 400 });
    await saveRule(user.id, { id: ruleId || undefined, name: name || undefined, enabled, conditions });
    return { success: true };
  }

  if (intent === "DELETE_RULE") {
    const ruleId = formData.get("ruleId") as string;
    if (!ruleId) return new Response("Rule ID required", { status: 400 });
    await deleteRule(ruleId, user.id);
    return { success: true };
  }

  if (intent === "SAVE_ALL_RULES") {
    const rulesStr = formData.get("rules") as string;
    if (!rulesStr) return new Response("Missing rules", { status: 400 });
    let rules;
    try { rules = JSON.parse(rulesStr); } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (!Array.isArray(rules)) return new Response("Expected array", { status: 400 });
    type RuleInput = { name?: string; enabled?: boolean; conditions: Prisma.InputJsonValue };
    await replaceAllRules(user.id, (rules as RuleInput[]).map(r => ({ name: r.name, enabled: r.enabled !== false, conditions: r.conditions })));
    return { success: true };
  }

  if (intent === "UPDATE_TIMEZONE") {
    const timezone = formData.get("timezone") as string;
    if (!timezone) return new Response("Timezone required", { status: 400 });
    await updateUserTimezone(user.id, timezone);
    return { success: true };
  }

  if (intent === "GENERATE_API_KEY") {
    await generateNewApiKey(user.id);
    return { success: true };
  }

  if (intent === "DISCONNECT") {
    const provider = formData.get("provider") as string;
    if (!provider) return new Response("Provider required", { status: 400 });
    await disconnectProvider(user.id, provider);
    return { success: true };
  }

  return { success: false };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, activeTimer: serverActiveTimer, wsUrl, connectedProviders, providerGroups, availableProviders, rules } = loaderData;

  const allProviderTabs = (providerGroups ?? []).flatMap(g => g.tabs);

  const TASKS_PER_PAGE = 8;

  const [activeTab, setActiveTab] = useState<string>("basecamp");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [tabItems, setTabItems] = useState<Record<string, TabState>>({});

  useEffect(() => {
    const validTabs = new Set(["basecamp", "history", ...allProviderTabs.map(t => t.tabId)]);
    if (!validTabs.has(activeTab)) setActiveTab("basecamp");
  }, [providerGroups]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasksCache, setTasksCache] = useState<Record<string, GroupedTask[]>>({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const selectedProjectTasks = selectedProjectId ? tasksCache[selectedProjectId] ?? null : null;

  const { activeTimer, startTimer, stopTimer, isPending } = useTimerWebSocket(
    user?.apiKey, wsUrl, serverActiveTimer
  );
  useTimerTitle(activeTimer);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const start = new Date(activeTimer.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeTimer?.startedAt]);

  const handleSelectProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setTaskPage(1);
    setGroupFilter("");
    if (tasksCache[projectId]) return;
    setIsLoadingTasks(true);
    try {
      const res = await fetch(`/api/project-tasks?projectId=${projectId}`);
      const { tasks } = await res.json();
      setTasksCache(prev => ({ ...prev, [projectId]: tasks }));
    } catch {
      setTasksCache(prev => ({ ...prev, [projectId]: [] }));
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "basecamp" || tabId === "history") return;
    if (tabItems[tabId]) return;
    setTabItems(prev => ({ ...prev, [tabId]: { status: "loading" } }));
    fetch(`/api/provider-items?tab=${tabId}`)
      .then(r => r.json())
      .then(({ items }) => setTabItems(prev => ({ ...prev, [tabId]: { status: "success", items } })))
      .catch(() => setTabItems(prev => ({ ...prev, [tabId]: { status: "error" } })));
  };

  if (!user) {
    return <LandingPage />;
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                <div className="flex aspect-square size-8 items-center justify-content rounded-lg bg-primary text-primary-foreground font-bold text-[13px] tracking-tight justify-center shrink-0">
                  BT
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Basetrack</span>
                  <span className="truncate text-xs text-muted-foreground">Time Tracker</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Source</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={activeTab === "basecamp"} onClick={() => setActiveTab("basecamp")} tooltip="Basecamp">
                    <Briefcase className="size-4 shrink-0" />
                    <span className="truncate">Basecamp</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {(providerGroups ?? []).map(group => {
            const isOpen = openGroups.has(group.providerId);
            return (
              <SidebarGroup key={group.providerId}>
                <SidebarGroupLabel className="pr-8">
                  {group.providerLabel}
                  <Badge variant="secondary" className="ml-1.5 font-mono text-[10px] px-1.5 py-0">
                    {group.tabs.length}
                  </Badge>
                </SidebarGroupLabel>
                <SidebarGroupAction
                  onClick={() => setOpenGroups(prev => {
                    const next = new Set(prev);
                    if (next.has(group.providerId)) next.delete(group.providerId);
                    else next.add(group.providerId);
                    return next;
                  })}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  <ChevronDown className={cn("size-3.5 transition-transform duration-200", isOpen ? "rotate-0" : "-rotate-90")} />
                </SidebarGroupAction>
                {isOpen && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.tabs.map(tab => {
                        const Icon = TAB_ICONS[tab.iconName];
                        return (
                          <SidebarMenuItem key={tab.tabId}>
                            <SidebarMenuButton isActive={activeTab === tab.tabId} onClick={() => handleTabClick(tab.tabId)} tooltip={tab.label}>
                              {Icon && <Icon className="size-4 shrink-0" />}
                              <span className="truncate">{tab.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={activeTab === "history"} onClick={() => setActiveTab("history")} tooltip="History">
                    <History className="size-4 shrink-0" />
                    <span className="truncate">History</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Suspense fallback={
            <SidebarGroup>
              <SidebarGroupLabel>Project Assignments</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[1, 2, 3].map(i => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuButton>
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 flex-1" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          }>
            <Await resolve={loaderData.data}>
              {(data) => data && activeTab === "basecamp" ? (
                <SidebarGroup>
                  <SidebarGroupLabel>Project Assignments</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {data.projects.map((p) => (
                        <SidebarMenuItem key={p.id}>
                          <SidebarMenuButton
                            isActive={p.id === selectedProjectId}
                            onClick={() => handleSelectProject(p.id)}
                            tooltip={p.name}
                            className="pr-7"
                          >
                            <Briefcase className="size-4 shrink-0" />
                            <span className="truncate">{p.name}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge className="font-mono text-[10px]">{p.taskCount}</SidebarMenuBadge>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : null}
            </Await>
          </Suspense>
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
                <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                  <SettingsModal
                    rules={rules}
                    userTimezone={user.timezone ?? "Asia/Jakarta"}
                    apiKey={user.apiKey}
                    connectedProviders={connectedProviders}
                    availableProviders={availableProviders}
                  />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="w-px h-4 bg-border" />
          <span className="text-xs text-muted-foreground">{activeTab === "history" ? "Logs /" : "Source /"}</span>
          <span className="text-sm font-semibold">
            {activeTab === "basecamp" ? "Basecamp"
              : activeTab === "history" ? "History"
                : allProviderTabs.find(t => t.tabId === activeTab)?.label ?? activeTab}
          </span>
          <div className="w-px h-4 bg-border" />
          <span className="font-mono text-xs text-muted-foreground">{today}</span>
          <div className={cn(
            "ml-auto flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-all",
            activeTimer
              ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(244,129,63,.3)]"
              : "border-border bg-card text-muted-foreground"
          )}>
            <span className={cn(
              "size-1.5 rounded-full shrink-0",
              activeTimer ? "bg-primary animate-live-pulse" : "bg-muted-foreground"
            )} />
            {activeTimer ? fmtTime(elapsed) : "No timer"}
          </div>
        </header>

        <div className="flex flex-1 items-start">
          <div className="flex-1 p-6">
            {activeTab === "history" ? (
              <HistoryPanel />
            ) : (
              <Suspense fallback={<ContentSkeleton />}>
                <Await resolve={loaderData.data}>
                  {(data) => {
                    if (!data) return <ContentSkeleton />;
                    return (
                      <>
                        {data.pendingApprovals?.length > 0 && (
                          <div className="mb-5">
                            <PendingApprovals approvals={data.pendingApprovals} />
                          </div>
                        )}

                        {activeTab === "basecamp" && (
                          <>
                            {data.projects.length === 0 ? (
                              <EmptyState icon={CheckCircle2} title="You're all caught up!" sub="No active assignments found in Basecamp." />
                            ) : !selectedProjectId ? (
                              <>
                                <p className="text-sm font-semibold mb-1">Your Projects</p>
                                <p className="text-xs text-muted-foreground mb-5">Click a project to see your assigned tasks.</p>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                                  {data.projects.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleSelectProject(p.id)}
                                      className="flex items-center gap-2.5 rounded-xl border bg-card p-3.5 text-left transition-all hover:-translate-y-px hover:shadow-md hover:border-muted-foreground text-sm font-medium"
                                    >
                                      <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
                                      <span className="flex-1 truncate">{p.name}</span>
                                      <Badge variant="secondary" className="font-mono text-[10px] shrink-0">{p.taskCount}</Badge>
                                    </button>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setSelectedProjectId(null); setTaskPage(1); setGroupFilter(""); }}
                                  className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ChevronLeft className="size-3.5" />
                                  All Projects
                                </button>
                                <p className="text-sm font-semibold mb-1">
                                  {data.projects.find(p => p.id === selectedProjectId)?.name}
                                </p>
                                <p className="text-xs text-muted-foreground mb-3">Select a task to start tracking.</p>
                                {isLoadingTasks ? (
                                  <ContentSkeleton />
                                ) : (selectedProjectTasks ?? []).length === 0 ? (
                                  <EmptyState icon={CheckCircle2} title="No tasks" sub="No active tasks in this project." />
                                ) : (() => {
                                  const tasks = selectedProjectTasks ?? [];
                                  const projectName = data.projects.find(p => p.id === selectedProjectId)?.name ?? "";

                                  // Group by card table name (for cards) or parent.title (for todos)
                                  const grouped: { label: string; tasks: GroupedTask[] }[] = [];
                                  const groupMap = new Map<string, GroupedTask[]>();
                                  for (const task of tasks) {
                                    const parentTitle = task.parent?.title ?? "";
                                    const key = task.type === "card"
                                      ? (parentTitle.includes(": ") ? parentTitle.split(": ")[0] : parentTitle)
                                      : parentTitle;
                                    if (!groupMap.has(key)) groupMap.set(key, []);
                                    groupMap.get(key)!.push(task);
                                  }
                                  // Preserve insertion order; empty key (no parent) goes last
                                  const noParent = groupMap.get("");
                                  groupMap.delete("");
                                  for (const [label, ts] of groupMap) grouped.push({ label, tasks: ts });
                                  if (noParent?.length) grouped.push({ label: "", tasks: noParent });

                                  // Named groups only (exclude ungrouped) for the select
                                  const namedGroups = grouped.filter(g => g.label !== "");

                                  // Filter groups by selected name
                                  const filteredGroups = groupFilter
                                    ? grouped.filter(g => g.label === groupFilter)
                                    : grouped;

                                  // Flatten for pagination after grouping
                                  const allPaginated = filteredGroups.flatMap(g => g.tasks);
                                  const totalPages = Math.ceil(allPaginated.length / TASKS_PER_PAGE);
                                  const pageStart = (taskPage - 1) * TASKS_PER_PAGE;
                                  const pageEnd = taskPage * TASKS_PER_PAGE;
                                  let seen = 0;
                                  const pagedGroups = filteredGroups.map(g => {
                                    const from = seen;
                                    seen += g.tasks.length;
                                    const sliced = g.tasks.slice(
                                      Math.max(0, pageStart - from),
                                      Math.max(0, pageEnd - from),
                                    );
                                    return { ...g, tasks: sliced };
                                  }).filter(g => g.tasks.length > 0);

                                  return (
                                    <>
                                      {namedGroups.length > 1 && (
                                        <Select value={groupFilter || "__all__"} onValueChange={v => { setGroupFilter(v === "__all__" ? "" : v); setTaskPage(1); }}>
                                          <SelectTrigger className="h-7 text-xs mb-4">
                                            <SelectValue>{groupFilter || "All groups"}</SelectValue>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__all__">All groups</SelectItem>
                                            {namedGroups.map(g => (
                                              <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                      <div className="flex flex-col gap-5">
                                        {pagedGroups.map(group => (
                                          <div key={group.label}>
                                            {group.label && (
                                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-0.5">
                                                {group.label}
                                              </p>
                                            )}
                                            <div className="flex flex-col gap-2">
                                              {group.tasks.map((task: GroupedTask) => (
                                                <BasecampTaskCard
                                                  key={task.id}
                                                  task={task}
                                                  projectId={selectedProjectId!}
                                                  projectName={projectName}
                                                  activeTimer={activeTimer}
                                                  onStart={startTimer}
                                                  onStop={stopTimer}
                                                  isPending={isPending}
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-5 pt-4 border-t">
                                          <span className="text-xs text-muted-foreground font-mono">
                                            {pageStart + 1}–{Math.min(pageEnd, allPaginated.length)} of {allPaginated.length}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <Button variant="outline" size="icon" className="size-7" disabled={taskPage === 1} onClick={() => setTaskPage(p => p - 1)}>
                                              <ChevronLeft className="size-3.5" />
                                            </Button>
                                            <span className="px-2 text-xs font-mono text-muted-foreground">{taskPage} / {totalPages}</span>
                                            <Button variant="outline" size="icon" className="size-7" disabled={taskPage === totalPages} onClick={() => setTaskPage(p => p + 1)}>
                                              <ChevronRight className="size-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            )}
                          </>
                        )}

                        {activeTab !== "basecamp" && (() => {
                          const tab = allProviderTabs.find(t => t.tabId === activeTab);
                          if (!tab) return null;
                          const state = tabItems[activeTab] ?? { status: "idle" };
                          if (state.status === "idle" || state.status === "loading") return <ContentSkeleton />;
                          if (state.status === "error") return (
                            <EmptyState icon={CheckCircle2} title="Failed to load" sub="Could not fetch items. Try switching tabs." />
                          );
                          const items = state.items;
                          if (items.length === 0) return (
                            <EmptyState icon={CheckCircle2} title="No items" sub="Nothing to track right now." />
                          );
                          return (
                            <>
                              <p className="text-sm font-semibold mb-1">{tab.label}</p>
                              <p className="text-xs text-muted-foreground mb-5">Select an item and choose a Basecamp project to start tracking.</p>
                              <div className="flex flex-col gap-2.5">
                                {items.map(item => (
                                  <TrackableItemCard
                                    key={item.id}
                                    item={item}
                                    projects={data.timesheetProjects}
                                    isActive={activeTimer?.todoId === item.id}
                                    onStart={startTimer}
                                    onStop={stopTimer}
                                    isPending={isPending}
                                  />
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </>
                    );
                  }}
                </Await>
              </Suspense>
            )}
          </div>

          <div className="sticky top-13 h-[calc(100vh-52px)] shrink-0">
            <TimerPanel activeTimer={activeTimer} elapsed={elapsed} onStop={stopTimer} isPending={isPending} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
