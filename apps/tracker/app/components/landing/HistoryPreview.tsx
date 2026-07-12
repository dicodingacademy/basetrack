import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarIcon, History } from "lucide-react";
import { cn } from "~/lib/utils";
import { EntryRow } from "~/components/home/EntryRow";
import { HourHeatmap } from "~/components/home/HourHeatmap";
import { WeekBarChart } from "~/components/home/WeekBarChart";
import { EmptyState } from "~/components/home/ContentSkeleton";
import { Flame, Target, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip as ReTooltip, Cell, ResponsiveContainer } from "recharts";
import type { TimeEntryRow, DailyTotal, HistoryFetcherData } from "~/types/tracker";

type ViewMode = "daily" | "weekly" | "monthly";

const todayStr = new Date().toLocaleDateString("en-CA");

const MOCK_ENTRIES: TimeEntryRow[] = [
  {
    id: "e1",
    todoTitle: "API integration",
    projectName: "Billing Project",
    startedAt: "2026-07-12T09:00:00",
    stoppedAt: "2026-07-12T11:15:00",
    durationSec: 8100,
    syncStatus: "SYNCED",
    syncError: null,
    source: "BASECAMP",
  },
  {
    id: "e2",
    todoTitle: "Design review",
    projectName: "Marketing Landing Page",
    startedAt: "2026-07-12T13:00:00",
    stoppedAt: "2026-07-12T14:30:00",
    durationSec: 5400,
    syncStatus: "SYNCED",
    syncError: null,
    source: "BASECAMP",
  },
  {
    id: "e3",
    todoTitle: "Weekly planning",
    projectName: "Internal",
    startedAt: "2026-07-12T15:30:00",
    stoppedAt: "2026-07-12T16:15:00",
    durationSec: 2700,
    syncStatus: "PENDING",
    syncError: null,
    source: "GOOGLE_CALENDAR",
  },
];

const DAILY_TOTAL_SEC = MOCK_ENTRIES.reduce((sum, e) => sum + e.durationSec, 0);

const DAILY_DATA: HistoryFetcherData = {
  mode: "daily",
  entries: MOCK_ENTRIES,
  total: MOCK_ENTRIES.length,
  date: todayStr,
  timeline: MOCK_ENTRIES.map(e => ({ startedAt: e.startedAt, stoppedAt: e.stoppedAt, source: e.source })),
  totalSec: DAILY_TOTAL_SEC,
};

function makeDailyTotals(start: string, count: number): DailyTotal[] {
  const result: DailyTotal[] = [];
  const d = new Date(start + "T12:00:00");
  for (let i = 0; i < count; i++) {
    const date = d.toLocaleDateString("en-CA");
    const active = [0, 2, 3, 5, 6].includes(i);
    result.push({
      date,
      totalSec: active ? Math.round((2 + Math.random() * 5) * 3600) : 0,
      count: active ? Math.floor(1 + Math.random() * 3) : 0,
    });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

const weekStart = "2026-07-06";
const weekEnd = "2026-07-12";
const weeklyTotals = makeDailyTotals(weekStart, 7);
weeklyTotals[6] = { date: todayStr, totalSec: DAILY_TOTAL_SEC, count: MOCK_ENTRIES.length };
const WEEKLY_DATA: HistoryFetcherData = {
  mode: "weekly",
  entries: MOCK_ENTRIES,
  total: MOCK_ENTRIES.length,
  weekStart,
  weekEnd,
  dailyTotals: weeklyTotals,
  weekTotalSec: weeklyTotals.reduce((sum, d) => sum + d.totalSec, 0),
};

const monthStart = "2026-07-01";
const monthEnd = "2026-07-31";
const monthlyEntries: TimeEntryRow[] = Array.from({ length: 20 }).map((_, i) => {
  const day = 1 + (i % 28);
  const date = `2026-07-${String(day).padStart(2, "0")}`;
  const durationSec = Math.round((0.5 + Math.random() * 4) * 3600);
  const sources = ["BASECAMP", "GOOGLE_CALENDAR", "GOOGLE_TASKS"];
  const source = sources[i % 3];
  const startHour = String(9 + (i % 8)).padStart(2, "0");
  const endHour = String(10 + (i % 8)).padStart(2, "0");
  return {
    id: `m${i}`,
    todoTitle: ["API integration", "Design review", "Weekly planning", "Bug fix", "Client call", "Documentation"][i % 6],
    projectName: ["Billing Project", "Marketing Landing Page", "Internal", "Mobile App"][i % 4],
    startedAt: `${date}T${startHour}:00:00`,
    stoppedAt: `${date}T${endHour}:00:00`,
    durationSec,
    syncStatus: i % 7 === 0 ? "FAILED" : "SYNCED",
    syncError: i % 7 === 0 ? "Basecamp API returned 422" : null,
    source,
  };
});

const monthlyTotals: DailyTotal[] = Array.from({ length: 31 }).map((_, i) => {
  const day = i + 1;
  const date = `2026-07-${String(day).padStart(2, "0")}`;
  const baseHours = 1 + ((day * 7) % 6) * 0.6;
  const hours = Math.max(0.5, baseHours + Math.sin(day) * 0.8);
  return {
    date,
    totalSec: Math.round(hours * 3600),
    count: Math.floor(1 + (day % 3)),
  };
});

const MONTHLY_DATA: HistoryFetcherData = {
  mode: "monthly",
  entries: monthlyEntries,
  total: monthlyEntries.length,
  monthStart,
  monthEnd,
  monthParam: "2026-07",
  dailyTotals: monthlyTotals,
  monthTotalSec: monthlyEntries.reduce((sum, e) => sum + e.durationSec, 0),
};

function fmtDurationShort(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function HistoryPreview() {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(todayStr);

  const filteredEntries = MOCK_ENTRIES.filter(e => {
    if (status !== "all" && e.syncStatus.toLowerCase() !== status) return false;
    if (source === "basecamp" && e.source !== "BASECAMP") return false;
    if (source === "calendar" && e.source !== "GOOGLE_CALENDAR") return false;
    if (source === "tasks" && e.source !== "GOOGLE_TASKS") return false;
    return true;
  });

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xl">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <p className="text-sm font-semibold mb-0.5">Time Tracking History</p>
          <p className="text-xs text-muted-foreground">Your logged time entries across all sources.</p>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "weekly", "monthly"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={cn(
                "px-3 py-1.5 capitalize transition-colors",
                viewMode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* daily view */}
      {viewMode === "daily" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" className="size-8 shrink-0">
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">Today</p>
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <ChevronRight className="size-3.5" />
            </Button>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <CalendarIcon className="size-3.5" />
            </button>
          </div>

          <div className="rounded-xl border bg-card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Total tracked</p>
                <p className="font-mono text-xl font-semibold mt-0.5">{fmtDurationShort(DAILY_DATA.totalSec ?? 0)}</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{DAILY_DATA.total} entries</span>
            </div>
            <HourHeatmap entries={DAILY_DATA.timeline ?? []} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="needs_approval">Needs Approval</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="basecamp">Basecamp</SelectItem>
                <SelectItem value="calendar">Google Calendar</SelectItem>
                <SelectItem value="tasks">Google Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredEntries.length === 0 ? (
            <EmptyState icon={History} title="No entries" sub="No time entries match the current filters." />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredEntries.map(e => (
                <EntryRow key={e.id} e={e} retryingId={null} onRetry={() => {}} />
              ))}
            </div>
          )}
        </>
      )}

      {/* weekly view */}
      {viewMode === "weekly" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" className="size-8 shrink-0">
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">
                {new Date(WEEKLY_DATA.weekStart!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" – "}
                {new Date(WEEKLY_DATA.weekEnd!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0">
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Week total</p>
                <p className="font-mono text-xl font-semibold mt-0.5">{fmtDurationShort(WEEKLY_DATA.weekTotalSec ?? 0)}</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{WEEKLY_DATA.total} entries</span>
            </div>
            <WeekBarChart
              dailyTotals={WEEKLY_DATA.dailyTotals ?? []}
              entries={WEEKLY_DATA.entries ?? []}
              selectedDay={selectedWeekDay}
              todayStr={todayStr}
              onDayClick={setSelectedWeekDay}
            />
          </div>

          <div className="flex flex-col gap-2">
            {MOCK_ENTRIES.map(e => (
              <EntryRow key={e.id} e={e} retryingId={null} onRetry={() => {}} />
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t">
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {new Date(todayStr + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "short", day: "numeric",
                })}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {MOCK_ENTRIES.length} entries
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </>
      )}

      {/* monthly view */}
      {viewMode === "monthly" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" className="size-8 shrink-0">
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">
                {new Date(MONTHLY_DATA.monthParam! + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <MonthlyPreviewCompact data={MONTHLY_DATA} />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "bg-primary/8 border-primary/20" : "bg-card")}>
      <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-mono text-base font-semibold leading-none", accent && "text-primary")}>{value}</p>
      {sub && <p className="text-[9.5px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ConsistencyRing({ activeDays, totalDays }: { activeDays: number; totalDays: number }) {
  const pct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
  const grade = pct >= 80 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : pct >= 20 ? "D" : "F";
  const gradeColor = pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-primary" : pct >= 40 ? "text-amber-500" : "text-red-500";
  const r = 18, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <div className="flex items-center gap-2.5">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="stroke-primary" />
      </svg>
      <div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-bold font-mono leading-none", gradeColor)}>{grade}</span>
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
        <p className="text-[9.5px] text-muted-foreground mt-0.5">{activeDays}/{totalDays} days active</p>
      </div>
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  BASECAMP: "var(--primary)",
  GOOGLE_CALENDAR: "#3b82f6",
  GOOGLE_TASKS: "#22c55e",
};

function MonthlyPreviewCompact({ data }: { data: HistoryFetcherData }) {
  const entries = data.entries ?? [];
  const monthTotalSec = data.monthTotalSec ?? 0;
  const dailyTotals = data.dailyTotals ?? [];
  const total = data.total ?? 0;

  const activeDays = dailyTotals.filter(d => d.count > 0).length;
  const totalDays = dailyTotals.length;
  const avgPerActiveDaySec = activeDays > 0 ? Math.floor(monthTotalSec / activeDays) : 0;

  const bestDay = dailyTotals.reduce(
    (b, d) => d.totalSec > (b?.totalSec ?? 0) ? d : b,
    null as DailyTotal | null,
  );

  const currentStreak = activeDays > 0 ? Math.min(activeDays, 4) : 0;
  const bestStreak = Math.max(currentStreak, 6);

  const sourceTotals = [
    { key: "BASECAMP", label: "Basecamp" },
    { key: "GOOGLE_CALENDAR", label: "Google Calendar" },
    { key: "GOOGLE_TASKS", label: "Google Tasks" },
  ].map(s => ({
    ...s,
    sec: entries.filter(e => e.source === s.key).reduce((sum, e) => sum + e.durationSec, 0),
  })).filter(s => s.sec > 0);

  return (
    <div className="space-y-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total tracked" value={fmtDurationShort(monthTotalSec)} sub={`${total} entries`} />
        <StatCard label="Avg / active day" value={activeDays > 0 ? fmtDurationShort(avgPerActiveDaySec) : "—"} sub={`${activeDays} days worked`} />
      </div>

      {/* daily activity */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Daily Activity</p>
          <ConsistencyRing activeDays={activeDays} totalDays={totalDays} />
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTotals} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tick={({ x, y, payload }) => {
                  const value = String(payload?.value ?? "");
                  const day = Number(value.split("-")[2]);
                  if (![1, 8, 15, 22, 29, 31].includes(day)) return null;
                  return <text x={Number(x)} y={Number(y) + 12} textAnchor="middle" style={{ fill: "var(--muted-foreground)", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}>{day}</text>;
                }}
                axisLine={false}
                tickLine={false}
              />
              <ReTooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as DailyTotal;
                  return (
                    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                      <p className="text-muted-foreground mb-0.5">{d.date}</p>
                      <p className="font-mono font-medium text-foreground">{fmtDurationShort(d.totalSec)}</p>
                      <p className="text-muted-foreground mt-0.5">{d.count} {d.count === 1 ? "entry" : "entries"}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalSec" radius={[3, 3, 0, 0]}>
                {dailyTotals.map((d, i) => (
                  <Cell
                    key={i}
                    fill="var(--primary)"
                    fillOpacity={d.totalSec > 0 ? 0.85 : 0.12}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* source breakdown */}
      {sourceTotals.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">By Source</p>
          <div className="space-y-2.5">
            {sourceTotals.map(s => {
              const pct = Math.round((s.sec / monthTotalSec) * 100);
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: SOURCE_COLORS[s.key] ?? "#888" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
                  </div>
                  <span className="text-[11px] font-mono text-foreground">{fmtDurationShort(s.sec)}</span>
                  <span className="text-[9.5px] font-mono text-muted-foreground shrink-0 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* streak callout */}
      {bestStreak >= 3 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Flame className="size-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              {currentStreak >= bestStreak && currentStreak >= 3 ? `${currentStreak}-day streak — keep it going!` : `Best streak this month: ${bestStreak} days`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeDays} active days · {Math.round((activeDays / totalDays) * 100)}% consistency
            </p>
          </div>
          <Target className="size-4 text-primary/50 shrink-0" />
        </div>
      )}
    </div>
  );
}
