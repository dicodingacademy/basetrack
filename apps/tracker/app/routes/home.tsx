import { useState, useEffect, Suspense } from "react";
import { Form, Await, useFetcher } from "react-router";

import type { Route } from "./+types/home";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { fetchAssignments, getValidAccessToken } from "../utils/basecamp.server";
import { getValidGoogleToken, fetchCalendarEvents, fetchTaskLists, fetchTasks } from "../utils/google.server";
import { getActiveTimer, getPendingApprovals, approveTimeEntry } from "../services/timer.server";
import { generateNewApiKey } from "../services/user.server";
import { getRules, saveRule, deleteRule, updateUserTimezone, replaceAllRules } from "../services/rules.server";
import { disconnectGoogle } from "../utils/google.server";
import { prisma } from "../utils/db.server";
import { randomUUID } from "node:crypto";

import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
import { ProjectPickerModal } from "../components/home/ProjectPickerModal";
import { PendingApprovals } from "../components/home/PendingApprovals";
import { SettingsModal } from "../components/home/SettingsModal";

import {
  Briefcase,
  Calendar,
  ListTodo,
  Clock,
  Square,
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  LogOut,
  History,
} from "lucide-react";

import type { BasecampAssignment, GroupedTask } from "../types/basecamp";
import type { GoogleCalendarEvent, GoogleTask } from "../types/google";
import type { Condition } from "../components/home/types";
import type { StartTimerData } from "../hooks/useTimerWebSocket";

type AppData = {
  projects: { id: string; name: string; taskCount: number }[];
  pendingApprovals: any[];
  timesheetProjects: { id: string; name: string }[];
  calendarEvents: GoogleCalendarEvent[];
  googleTasks: GoogleTask[];
};

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

async function loadData(user: any): Promise<AppData> {
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

  let calendarEvents: GoogleCalendarEvent[] = [];
  let googleTasks: GoogleTask[] = [];

  if (user.googleAccessToken) {
    try {
      const googleToken = await getValidGoogleToken(user.id);
      const events = await fetchCalendarEvents(googleToken, new Date());
      calendarEvents = (events || []).map((e: any) => ({
        id: e.id,
        summary: e.summary || "Untitled Event",
        description: e.description,
        htmlLink: e.htmlLink,
        start: e.start,
        end: e.end,
      }));
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    }

    try {
      const googleToken = await getValidGoogleToken(user.id);
      const taskLists = await fetchTaskLists(googleToken);
      const allTasks: GoogleTask[] = [];
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      for (const list of taskLists) {
        try {
          const tasks = await fetchTasks(googleToken, list.id);
          for (const t of tasks) {
            const mappedTask = {
              id: t.id,
              title: t.title || "Untitled Task",
              notes: t.notes,
              due: t.due,
              taskListId: list.id,
              taskListName: list.title,
            };
            if (t.due) {
              const dueDate = new Date(t.due);
              if (dueDate <= endOfToday) {
                allTasks.push(mappedTask);
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch tasks for list ${list.title}:`, err);
        }
      }
      googleTasks = allTasks;
    } catch (err) {
      console.error("Failed to fetch task lists:", err);
    }
  }

  return { projects, pendingApprovals, timesheetProjects, calendarEvents, googleTasks };
}

export async function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");

  if (!sessionId) {
    return { user: null, activeTimer: null, googleConnected: false, data: null };
  }

  let user = await getUserFromSessionId(sessionId);

  if (!user) {
    return { user: null, activeTimer: null, googleConnected: false, data: null };
  }

  if (!user.apiKey) {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: randomUUID() },
    });
    user = await getUserFromSessionId(sessionId);
  }

  const activeTimer = await getActiveTimer(user!.id);
  const rules = (await getRules(user!.id)).map((r) => ({
    ...r,
    conditions: r.conditions as unknown as Condition[],
  }));

  return {
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      timezone: user!.timezone,
      apiKey: user!.apiKey,
    },
    googleConnected: !!user!.googleAccessToken,
    activeTimer,
    rules,
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
    if (!entryId || isNaN(durationHours)) {
      return new Response("Invalid data", { status: 400 });
    }
    return await approveTimeEntry(user.id, entryId, user.basecampAccountId, Math.floor(durationHours * 3600));
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
    await replaceAllRules(user.id, rules.map((r: any) => ({ name: r.name, enabled: r.enabled !== false, conditions: r.conditions })));
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

  if (intent === "DISCONNECT_GOOGLE") {
    await disconnectGoogle(user.id);
    return { success: true };
  }

  return { success: false };
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── EVENT CARD (shared by Basecamp tasks, Calendar events, Google Tasks) ─

type EventCardProps = {
  isActive: boolean;
  timeLabel: string;
  typeLabel: string;
  title: string;
  tags?: string[];
  isPending: boolean;
  onStop: () => void;
  startSlot: React.ReactNode;
};

function EventCard({ isActive, timeLabel, typeLabel, title, tags, isPending, onStop, startSlot }: EventCardProps) {
  return (
    <div className={cn(
      "group flex items-stretch rounded-xl border bg-card overflow-hidden transition-all",
      "hover:-translate-y-px hover:shadow-lg hover:border-muted-foreground",
      isActive && "border-primary bg-primary/10"
    )}>
      <div className={cn("w-1 shrink-0 bg-border transition-colors", isActive && "bg-primary")} />
      <div className="flex flex-1 items-center gap-3.5 px-4 py-3.5 min-w-0">
        <div className="w-14 shrink-0">
          <p className={cn("font-mono text-[13px] font-medium leading-none", isActive ? "text-primary" : "text-foreground")}>
            {timeLabel}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{typeLabel}</p>
        </div>
        <div className="w-px h-7 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium truncate text-foreground">{title}</p>
          {tags && tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {tags.map(t => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 rounded-sm h-auto">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center px-3 shrink-0">
        {isActive ? (
          <Button variant="destructive" size="sm" disabled={isPending} onClick={onStop} className="gap-1.5">
            <Square className="size-2.5 fill-current" />
            Stop
          </Button>
        ) : startSlot}
      </div>
    </div>
  );
}

// ── BASECAMP TASK CARD ───────────────────────────────────────────────────

function BasecampTaskCard({ task, projectId, projectName, activeTimer, onStart, onStop, isPending }: {
  task: GroupedTask;
  projectId: string;
  projectName: string;
  activeTimer: any;
  onStart: (d: StartTimerData) => void;
  onStop: () => void;
  isPending: boolean;
}) {
  const isActive = activeTimer?.todoId === task.id;
  const dateLabel = task.dueOn
    ? new Date(task.dueOn).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  return (
    <EventCard
      isActive={isActive}
      timeLabel={dateLabel}
      typeLabel="Basecamp"
      title={task.title}
      tags={task.parent ? [task.parent.title] : undefined}
      isPending={isPending}
      onStop={onStop}
      startSlot={
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || (!!activeTimer && !isActive)}
          onClick={() => onStart({ todoId: task.id, todoTitle: task.title, projectId, projectName })}
          className="gap-1.5"
        >
          <Play className="size-2.5 fill-current" />
          Start
        </Button>
      }
    />
  );
}

// ── GOOGLE EVENT CARD ────────────────────────────────────────────────────

function GoogleEventCard({ item, source, projects, isActive, onStart, onStop, isPending }: {
  item: GoogleCalendarEvent | GoogleTask;
  source: "GOOGLE_CALENDAR" | "GOOGLE_TASKS";
  projects: { id: string; name: string }[];
  isActive: boolean;
  onStart: (d: StartTimerData) => void;
  onStop: () => void;
  isPending: boolean;
}) {
  const isCalendar = source === "GOOGLE_CALENDAR";
  const displayTitle = isCalendar
    ? (item as GoogleCalendarEvent).summary || "Untitled Event"
    : (item as GoogleTask).title || "Untitled Task";

  const timeLabel = isCalendar
    ? (() => {
        const ev = item as GoogleCalendarEvent;
        return ev.start.dateTime
          ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "All day";
      })()
    : (() => {
        const task = item as GoogleTask;
        return task.due
          ? new Date(task.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "No due";
      })();

  const handleSelect = async (project: { id: string; name: string }) => {
    const res = await fetch(`/api/check-timesheet?projectId=${project.id}`);
    const { available } = await res.json();
    if (!available) {
      throw new Error(
        "Project ini belum punya time entry di Basecamp. Log minimal satu time entry manual di Basecamp untuk project ini terlebih dahulu."
      );
    }
    onStart({ todoId: item.id, todoTitle: displayTitle, projectId: project.id, projectName: project.name, source });
  };

  return (
    <EventCard
      isActive={isActive}
      timeLabel={timeLabel}
      typeLabel={isCalendar ? "Calendar" : "Task"}
      title={displayTitle}
      isPending={isPending}
      onStop={onStop}
      startSlot={
        <ProjectPickerModal projects={projects} onSelect={handleSelect}>
          <Button variant="outline" size="sm" disabled={isPending} className="gap-1.5">
            <Play className="size-2.5 fill-current" />
            Start
          </Button>
        </ProjectPickerModal>
      }
    />
  );
}

// ── CONTENT SKELETON ─────────────────────────────────────────────────────

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Icon className="size-12 text-muted-foreground" />
      <p className="font-semibold text-base">{title}</p>
      <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">{sub}</p>
    </div>
  );
}

// ── TIMER PANEL ──────────────────────────────────────────────────────────

function TimerPanel({ activeTimer, elapsed, onStop, isPending }: {
  activeTimer: any;
  elapsed: number;
  onStop: () => void;
  isPending: boolean;
}) {
  return (
    <div className="w-[270px] h-full border-l bg-sidebar flex flex-col overflow-hidden">
      {activeTimer ? (
        <>
          <div className="px-5 pt-5 pb-0">
            <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Running</p>
            <p className="font-mono text-[50px] font-light text-primary leading-none mt-2.5 mb-1.5 tracking-tight">
              {fmtTime(elapsed)}
            </p>
            <p className="text-[12.5px] text-muted-foreground leading-snug pb-4 border-b border-border">
              {activeTimer.todoTitle}
            </p>
          </div>
          <div className="px-5 py-3.5 border-b border-border">
            <Button
              variant="destructive"
              className="w-full gap-2"
              size="sm"
              disabled={isPending}
              onClick={onStop}
            >
              <Square className="size-2.5 fill-current" />
              Stop Timer
            </Button>
          </div>
          <div className="px-5 py-4 flex-1 overflow-y-auto">
            <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-2">Project</p>
            <p className="text-[11.5px] text-muted-foreground">{activeTimer.projectName}</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-5 py-8 text-center">
          <div className="size-14 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground">
            <Clock className="size-5" />
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            No timer running.<br />Pick an item to track.
          </p>
        </div>
      )}
    </div>
  );
}

// ── HISTORY PANEL ────────────────────────────────────────────────────────

function HistoryPanel() {
  const fetcher = useFetcher<{ entries: any[]; total: number; page: number; pageSize: number }>();
  const retryFetcher = useFetcher<{ success: boolean; syncError?: string }>();
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [datePreset, setDatePreset] = useState<"7" | "30" | "90">("30");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadEntries = (overrides?: { status?: string; source?: string; page?: number; datePreset?: string }) => {
    const s = overrides?.status ?? status;
    const src = overrides?.source ?? source;
    const p = overrides?.page ?? page;
    const d = overrides?.datePreset ?? datePreset;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(d));
    const fromStr = from.toISOString().split("T")[0];
    fetcher.load(`/api/time-entries?page=${p}&status=${s}&source=${src}&from=${fromStr}`);
  };

  useEffect(() => { loadEntries(); }, [status, source, page, datePreset]);

  useEffect(() => {
    if (retryFetcher.state === "idle" && retryingId !== null) {
      setRetryingId(null);
      loadEntries();
    }
  }, [retryFetcher.state]);

  const handleRetry = (entryId: string) => {
    setRetryingId(entryId);
    retryFetcher.submit({ entryId }, { method: "post", action: "/api/time-entries/retry" });
  };

  const entries: any[] = fetcher.data?.entries ?? [];
  const total = fetcher.data?.total ?? 0;
  const pageSize = fetcher.data?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  const grouped: Record<string, any[]> = {};
  for (const e of entries) {
    const key = new Date(e.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const sourceBar: Record<string, string> = {
    BASECAMP: "bg-primary",
    GOOGLE_CALENDAR: "bg-blue-500",
    GOOGLE_TASKS: "bg-emerald-500",
  };

  const statusStyle: Record<string, string> = {
    SYNCED: "bg-emerald-500/15 text-emerald-400",
    FAILED: "bg-destructive/15 text-destructive",
    NEEDS_APPROVAL: "bg-primary/15 text-primary",
    PENDING: "bg-yellow-500/15 text-yellow-400",
  };

  const statusLabel: Record<string, string> = {
    SYNCED: "Synced",
    FAILED: "Failed",
    NEEDS_APPROVAL: "Needs Approval",
    PENDING: "Pending",
  };

  const selectClass = "h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div>
      <p className="text-sm font-semibold mb-1">Time Tracking History</p>
      <p className="text-xs text-muted-foreground mb-5">Your logged time entries across all sources.</p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["7", "30", "90"] as const).map(d => (
            <button
              key={d}
              onClick={() => { setDatePreset(d); setPage(1); loadEntries({ datePreset: d, page: 1 }); }}
              className={cn(
                "px-3 py-1.5 transition-colors",
                datePreset === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); loadEntries({ status: e.target.value, page: 1 }); }} className={selectClass}>
          <option value="all">All status</option>
          <option value="synced">Synced</option>
          <option value="needs_approval">Needs Approval</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1); loadEntries({ source: e.target.value, page: 1 }); }} className={selectClass}>
          <option value="all">All sources</option>
          <option value="basecamp">Basecamp</option>
          <option value="calendar">Google Calendar</option>
          <option value="tasks">Google Tasks</option>
        </select>
        {total > 0 && (
          <span className="ml-auto text-xs text-muted-foreground font-mono">{total} entries</span>
        )}
      </div>

      {fetcher.state === "loading" && <ContentSkeleton />}

      {fetcher.state !== "loading" && entries.length === 0 && (
        <EmptyState icon={History} title="No time entries" sub="No entries found for the selected filters." />
      )}

      {fetcher.state !== "loading" && entries.length > 0 && (
        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground mb-2">{date}</p>
              <div className="flex flex-col gap-2">
                {items.map((e: any) => {
                  const isTooShort = e.syncStatus === "FAILED" && e.durationSec < 60;
                  const isRetryable = e.syncStatus === "FAILED" && e.durationSec >= 60;
                  const isRetrying = retryingId === e.id;
                  return (
                    <div key={e.id} className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-stretch">
                        <div className={cn("w-1 shrink-0", sourceBar[e.source] ?? "bg-muted-foreground")} />
                        <div className="flex flex-1 items-center gap-3.5 px-4 py-3 min-w-0">
                          <div className="w-16 shrink-0">
                            <p className="font-mono text-[13px] font-medium text-foreground leading-none">
                              {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDuration(e.durationSec)}</p>
                          </div>
                          <div className="w-px h-7 bg-border shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate text-foreground">{e.todoTitle}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{e.projectName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isTooShort ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap" title="Duration too short for Basecamp sync">
                                Too short
                              </span>
                            ) : (
                              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", statusStyle[e.syncStatus] ?? "bg-muted text-muted-foreground")}>
                                {statusLabel[e.syncStatus] ?? e.syncStatus}
                              </span>
                            )}
                            {isRetryable && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                disabled={isRetrying}
                                onClick={() => handleRetry(e.id)}
                              >
                                {isRetrying ? "Syncing…" : "Retry"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {e.syncError && !isTooShort && (
                        <div className="px-5 pb-2.5 ml-1">
                          <p className="text-[10.5px] text-destructive leading-snug">{e.syncError}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t">
          <span className="text-xs text-muted-foreground font-mono">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 text-xs font-mono text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="size-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, activeTimer: serverActiveTimer, wsUrl, googleConnected, rules } = loaderData;

  const TASKS_PER_PAGE = 8;

  const [activeTab, setActiveTab] = useState<"basecamp" | "calendar" | "tasks" | "history">("basecamp");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasksCache, setTasksCache] = useState<Record<string, GroupedTask[]>>({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
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

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl">
            BT
          </div>
          <h1 className="mb-2 text-2xl font-bold">Basetrack</h1>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            Seamlessly track time for your Basecamp tasks.
          </p>
          <Button render={<a href="/auth/basecamp" />} className="w-full" size="lg">
            Login with Basecamp
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <SidebarProvider>
      {/* ICON RAIL SIDEBAR */}
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
                  <SidebarMenuButton
                    isActive={activeTab === "basecamp"}
                    onClick={() => setActiveTab("basecamp")}
                    tooltip="Basecamp"
                  >
                    <Briefcase className="size-4 shrink-0" />
                    <span className="truncate">Basecamp</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "calendar"}
                    onClick={() => setActiveTab("calendar")}
                    tooltip="Calendar"
                  >
                    <Calendar className="size-4 shrink-0" />
                    <span className="truncate">Calendar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "tasks"}
                    onClick={() => setActiveTab("tasks")}
                    tooltip="Google Tasks"
                  >
                    <ListTodo className="size-4 shrink-0" />
                    <span className="truncate">Tasks</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeTab === "history"}
                    onClick={() => setActiveTab("history")}
                    tooltip="History"
                  >
                    <History className="size-4 shrink-0" />
                    <span className="truncate">History</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Project list only visible in Basecamp tab */}
          <Suspense fallback={
            <SidebarGroup>
              <SidebarGroupLabel>Project Assignments</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[1,2,3].map(i => (
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
                    googleConnected={googleConnected}
                  />
                  <Form method="post" action="/auth/logout">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      title="Logout"
                    >
                      <LogOut className="size-4" />
                    </Button>
                  </Form>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* MAIN CONTENT */}
      <SidebarInset className="flex flex-col">
        {/* TOPBAR */}
        <header className="sticky top-0 z-10 flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="w-px h-4 bg-border" />
          <span className="text-xs text-muted-foreground">{activeTab === "history" ? "Logs /" : "Source /"}</span>
          <span className="text-sm font-semibold capitalize">{activeTab}</span>
          <div className="w-px h-4 bg-border" />
          <span className="font-mono text-xs text-muted-foreground">{today}</span>

          {/* Live timer chip */}
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

        {/* CONTENT + TIMER PANEL */}
        <div className="flex flex-1 items-start">
          {/* SCROLLABLE CONTENT */}
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

                      {/* BASECAMP TAB */}
                      {activeTab === "basecamp" && (
                        <>
                          {data.projects.length === 0 ? (
                            <EmptyState
                              icon={CheckCircle2}
                              title="You're all caught up!"
                              sub="No active assignments found in Basecamp."
                            />
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
                                onClick={() => { setSelectedProjectId(null); setTaskPage(1); }}
                                className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ChevronLeft className="size-3.5" />
                                All Projects
                              </button>
                              <p className="text-sm font-semibold mb-1">
                                {data.projects.find(p => p.id === selectedProjectId)?.name}
                              </p>
                              <p className="text-xs text-muted-foreground mb-5">Select a task to start tracking.</p>
                              {isLoadingTasks ? (
                                <ContentSkeleton />
                              ) : (selectedProjectTasks ?? []).length === 0 ? (
                                <EmptyState icon={CheckCircle2} title="No tasks" sub="No active tasks in this project." />
                              ) : (() => {
                                const tasks = selectedProjectTasks ?? [];
                                const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
                                const paginated = tasks.slice((taskPage - 1) * TASKS_PER_PAGE, taskPage * TASKS_PER_PAGE);
                                const projectName = data.projects.find(p => p.id === selectedProjectId)?.name ?? "";
                                return (
                                  <>
                                    <div className="flex flex-col gap-2.5">
                                      {paginated.map((task: GroupedTask) => (
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
                                    {totalPages > 1 && (
                                      <div className="flex items-center justify-between mt-5 pt-4 border-t">
                                        <span className="text-xs text-muted-foreground font-mono">
                                          {(taskPage - 1) * TASKS_PER_PAGE + 1}–{Math.min(taskPage * TASKS_PER_PAGE, tasks.length)} of {tasks.length}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            disabled={taskPage === 1}
                                            onClick={() => setTaskPage(p => p - 1)}
                                          >
                                            <ChevronLeft className="size-3.5" />
                                          </Button>
                                          <span className="px-2 text-xs font-mono text-muted-foreground">
                                            {taskPage} / {totalPages}
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            disabled={taskPage === totalPages}
                                            onClick={() => setTaskPage(p => p + 1)}
                                          >
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

                      {/* CALENDAR TAB */}
                      {activeTab === "calendar" && (
                        <>
                          {!googleConnected ? (
                            <EmptyState
                              icon={Calendar}
                              title="Google Calendar not connected"
                              sub="Connect your Google account in Settings to see your calendar events here."
                            />
                          ) : data.calendarEvents.length === 0 ? (
                            <EmptyState icon={Calendar} title="No events today" sub="No calendar events scheduled for today." />
                          ) : (
                            <>
                              <p className="text-sm font-semibold mb-1">Today's Events</p>
                              <p className="text-xs text-muted-foreground mb-5">Select an event and choose a Basecamp project to start tracking.</p>
                              <div className="flex flex-col gap-2.5">
                                {data.calendarEvents.map((event: GoogleCalendarEvent) => (
                                  <GoogleEventCard
                                    key={event.id}
                                    item={event}
                                    source="GOOGLE_CALENDAR"
                                    projects={data.timesheetProjects}
                                    isActive={activeTimer?.todoId === event.id}
                                    onStart={startTimer}
                                    onStop={stopTimer}
                                    isPending={isPending}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {/* TASKS TAB */}
                      {activeTab === "tasks" && (
                        <>
                          {!googleConnected ? (
                            <EmptyState
                              icon={ListTodo}
                              title="Google Tasks not connected"
                              sub="Connect your Google account in Settings to see your tasks here."
                            />
                          ) : data.googleTasks.length === 0 ? (
                            <EmptyState icon={ListTodo} title="No pending tasks" sub="No pending tasks in Google Tasks." />
                          ) : (
                            <>
                              <p className="text-sm font-semibold mb-1">Google Tasks</p>
                              <p className="text-xs text-muted-foreground mb-5">Select a task and choose a Basecamp project to start tracking.</p>
                              <div className="flex flex-col gap-2.5">
                                {data.googleTasks.map((task: GoogleTask) => (
                                  <GoogleEventCard
                                    key={task.id}
                                    item={task}
                                    source="GOOGLE_TASKS"
                                    projects={data.timesheetProjects}
                                    isActive={activeTimer?.todoId === task.id}
                                    onStart={startTimer}
                                    onStop={stopTimer}
                                    isPending={isPending}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </>
                  );
                }}
              </Await>
            </Suspense>
            )}
          </div>

          {/* RIGHT TIMER PANEL — sticky so it stays in view while content scrolls */}
          <div className="sticky top-13 h-[calc(100vh-52px)] shrink-0">
            <TimerPanel activeTimer={activeTimer} elapsed={elapsed} onStop={stopTimer} isPending={isPending} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
