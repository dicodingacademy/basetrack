import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ChevronLeft, ChevronRight, History, CalendarIcon } from "lucide-react";
import { fmtDurationShort } from "../../lib/format";
import { ContentSkeleton, EmptyState } from "./ContentSkeleton";
import { HourHeatmap } from "./HourHeatmap";
import { WeekBarChart } from "./WeekBarChart";
import { EntryRow } from "./EntryRow";
import type { HistoryFetcherData, TimeEntryRow } from "../../types/tracker";

const SELECT_CLASS = "h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

export function HistoryPanel() {
  const fetcher = useFetcher<HistoryFetcherData>();
  const retryFetcher = useFetcher<{ success: boolean; syncError?: string }>();

  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [dailyDate, setDailyDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [weekDate, setWeekDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  // Cache last good data per mode so switching modes never shows an empty card
  const lastDailyRef = useRef<HistoryFetcherData | null>(null);
  const lastWeeklyRef = useRef<HistoryFetcherData | null>(null);

  const todayStr = new Date().toLocaleDateString("en-CA");

  const load = (overrides?: Partial<{ mode: string; date: string; weekDate: string; status: string; source: string }>) => {
    const m = overrides?.mode ?? viewMode;
    const s = overrides?.status ?? status;
    const src = overrides?.source ?? source;
    if (m === "daily") {
      const d = overrides?.date ?? dailyDate;
      fetcher.load(`/api/time-entries?mode=daily&date=${d}&status=${s}&source=${src}`);
    } else {
      const d = overrides?.weekDate ?? weekDate;
      fetcher.load(`/api/time-entries?mode=weekly&date=${d}`);
    }
  };

  useEffect(() => { load(); }, [viewMode, dailyDate, weekDate, status, source]);

  useEffect(() => {
    if (retryFetcher.state === "idle" && retryingId !== null) {
      setRetryingId(null);
      load();
    }
  }, [retryFetcher.state]);

  // Update refs whenever new data arrives
  const fetchedData = fetcher.data;
  if (fetchedData?.mode === "daily") lastDailyRef.current = fetchedData;
  if (fetchedData?.mode === "weekly") lastWeeklyRef.current = fetchedData;

  const handleRetry = (entryId: string) => {
    setRetryingId(entryId);
    retryFetcher.submit({ entryId }, { method: "post", action: "/api/time-entries/retry" });
  };

  const navigateDay = (dir: -1 | 1) => {
    const d = new Date(dailyDate + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setDailyDate(d.toISOString().split("T")[0]);
  };

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(weekDate + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekDate(d.toISOString().split("T")[0]);
    setSelectedWeekDay(null);
  };

  const nextWeekDate = (() => {
    const d = new Date(weekDate + "T12:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();

  const isLoading = fetcher.state === "loading";

  // Use cached data when live data isn't available for current mode yet
  const dailyData = viewMode === "daily"
    ? (fetchedData?.mode === "daily" ? fetchedData : lastDailyRef.current)
    : null;
  const weekData = viewMode === "weekly"
    ? (fetchedData?.mode === "weekly" ? fetchedData : lastWeeklyRef.current)
    : null;

  const isFirstLoad = isLoading && (viewMode === "daily" ? !lastDailyRef.current : !lastWeeklyRef.current);

  const allEntries: TimeEntryRow[] = (viewMode === "daily" ? dailyData : weekData)?.entries ?? [];

  const filteredEntries: TimeEntryRow[] = viewMode === "weekly" && selectedWeekDay
    ? allEntries.filter(e => e.startedAt.startsWith(selectedWeekDay))
    : allEntries;

  const handleDayClick = (date: string) => setSelectedWeekDay(date || null);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold mb-0.5">Time Tracking History</p>
          <p className="text-xs text-muted-foreground">Your logged time entries across all sources.</p>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "weekly"] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                "px-3 py-1.5 capitalize transition-colors",
                viewMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "daily" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">
                {dailyDate === todayStr
                  ? "Today"
                  : new Date(dailyDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })}
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled={dailyDate >= todayStr} onClick={() => navigateDay(1)}>
              <ChevronRight className="size-3.5" />
            </Button>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors">
                <CalendarIcon className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" side="bottom" align="end">
                <Calendar
                  mode="single"
                  selected={new Date(dailyDate + "T12:00:00")}
                  onSelect={date => {
                    if (date) {
                      setDailyDate(date.toISOString().split("T")[0]);
                      setCalOpen(false);
                    }
                  }}
                  disabled={date => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Summary card — fixed structure, opacity fade during reload */}
          <div className="rounded-xl border bg-card p-4 mb-4">
            {isFirstLoad ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : dailyData ? (
              <div className={cn("transition-opacity duration-150", isLoading && "opacity-40")}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Total tracked</p>
                    <p className="font-mono text-xl font-semibold text-foreground mt-0.5">
                      {fmtDurationShort(dailyData.totalSec ?? 0)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{dailyData.total} entries</span>
                </div>
                <HourHeatmap entries={dailyData.timeline ?? []} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={status} onChange={e => setStatus(e.target.value)} className={SELECT_CLASS}>
              <option value="all">All status</option>
              <option value="synced">Synced</option>
              <option value="needs_approval">Needs Approval</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <select value={source} onChange={e => setSource(e.target.value)} className={SELECT_CLASS}>
              <option value="all">All sources</option>
              <option value="basecamp">Basecamp</option>
              <option value="calendar">Google Calendar</option>
              <option value="tasks">Google Tasks</option>
            </select>
          </div>

          {/* Entry list — skeleton only on first load, opacity fade on reload */}
          {isFirstLoad ? (
            <ContentSkeleton />
          ) : (
            <div className={cn("transition-opacity duration-150", isLoading && "opacity-40")}>
              {filteredEntries.length === 0 ? (
                <EmptyState icon={History} title="No entries" sub="No time entries logged for this day." />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredEntries.map(e => (
                    <EntryRow key={e.id} e={e} retryingId={retryingId} onRetry={handleRetry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === "weekly" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="flex-1 text-center min-h-[20px]">
              {weekData ? (
                <p className={cn("text-sm font-semibold transition-opacity duration-150", isLoading && "opacity-40")}>
                  {new Date(weekData.weekStart!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" – "}
                  {new Date(weekData.weekEnd!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              ) : (
                <Skeleton className="h-4 w-32 mx-auto" />
              )}
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled={nextWeekDate > todayStr} onClick={() => navigateWeek(1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {/* Summary card — fixed structure, opacity fade during reload */}
          <div className="rounded-xl border bg-card p-4 mb-4">
            {isFirstLoad ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : weekData ? (
              <div className={cn("transition-opacity duration-150", isLoading && "opacity-40")}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Week total</p>
                    <p className="font-mono text-xl font-semibold text-foreground mt-0.5">
                      {fmtDurationShort(weekData.weekTotalSec ?? 0)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{weekData.total} entries</span>
                </div>
                <WeekBarChart
                  dailyTotals={weekData.dailyTotals ?? []}
                  selectedDay={selectedWeekDay}
                  todayStr={todayStr}
                  onDayClick={handleDayClick}
                />
              </div>
            ) : null}
          </div>

          {/* Entry list — skeleton only on first load, opacity fade on reload */}
          {isFirstLoad ? (
            <ContentSkeleton />
          ) : (
            <div className={cn("transition-opacity duration-150", isLoading && "opacity-40")}>
              {filteredEntries.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No entries"
                  sub={selectedWeekDay ? "No entries for this day." : "No time entries logged this week."}
                />
              ) : (() => {
                const grouped: Record<string, TimeEntryRow[]> = {};
                for (const e of filteredEntries) {
                  const key = new Date(e.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(e);
                }
                return (
                  <div className="flex flex-col gap-5">
                    {Object.entries(grouped).map(([date, items]) => (
                      <div key={date}>
                        <p className="text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground mb-2">{date}</p>
                        <div className="flex flex-col gap-2">
                          {items.map(e => (
                            <EntryRow key={e.id} e={e} retryingId={retryingId} onRetry={handleRetry} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
