import { useEffect } from "react";
import { useFetcher } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Clock, Square, Briefcase, Calendar, ListTodo, History } from "lucide-react";
import { fmtTime, fmtDurationShort } from "../../lib/format";
import type { ActiveTimer, HistoryFetcherData, TimeEntryRow } from "../../types/tracker";

const STATUS_BORDER: Record<string, string> = {
  SYNCED: "border-l-green-500",
  FAILED: "border-l-red-500",
  NEEDS_APPROVAL: "border-l-amber-400",
  PENDING: "border-l-muted-foreground/30",
};

const SOURCE_ICON: Record<string, React.ElementType> = {
  BASECAMP: Briefcase,
  GOOGLE_CALENDAR: Calendar,
  GOOGLE_TASKS: ListTodo,
};

function TodayEntry({ e }: { e: TimeEntryRow }) {
  const Icon = SOURCE_ICON[e.source] ?? Briefcase;
  const borderColor = STATUS_BORDER[e.syncStatus] ?? "border-l-muted-foreground/30";

  const start = new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const end = new Date(e.stoppedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex items-start gap-3 pl-3 pr-4 py-3 border-b border-border/60 last:border-0 border-l-2", borderColor)}>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-snug truncate">{e.todoTitle}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate">{e.projectName}</span>
          <span className="text-[10px] text-muted-foreground/50 shrink-0 font-mono ml-auto">{start}–{end}</span>
        </div>
      </div>
      <span className="text-[11px] font-mono font-medium text-foreground shrink-0 mt-0.5">
        {fmtDurationShort(e.durationSec)}
      </span>
    </div>
  );
}

export function TimerPanel({ activeTimer, elapsed, onStop, isPending }: {
  activeTimer: ActiveTimer | null;
  elapsed: number;
  onStop: () => void;
  isPending: boolean;
}) {
  const todayFetcher = useFetcher<HistoryFetcherData>();

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    todayFetcher.load(`/api/time-entries?mode=daily&date=${today}`);
  }, [activeTimer?.startedAt]);

  const todayTotalSec: number = todayFetcher.data?.totalSec ?? 0;
  const todayEntries: TimeEntryRow[] = todayFetcher.data?.entries ?? [];
  const projectCount = new Set(todayEntries.map(e => e.projectName)).size;

  return (
    <div className="w-[270px] h-full border-l bg-sidebar flex flex-col overflow-hidden">
      {/* Today summary */}
      <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-2">Today</p>
        <div className="flex items-center gap-2 mb-1">
          <p className={cn("font-mono text-2xl font-semibold leading-none", todayTotalSec > 0 ? "text-foreground" : "text-muted-foreground")}>
            {fmtDurationShort(todayTotalSec)}
          </p>
          {activeTimer && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
              + running
            </span>
          )}
        </div>
        {todayEntries.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70">
            {todayEntries.length} {todayEntries.length === 1 ? "entry" : "entries"} · {projectCount} {projectCount === 1 ? "project" : "projects"}
          </p>
        )}
      </div>

      {/* Active timer or idle state */}
      {activeTimer ? (
        <div className="px-5 pt-4 pb-4 border-b border-border shrink-0">
          <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-2">Running</p>
          <p className="text-[12.5px] font-medium text-foreground leading-snug truncate">{activeTimer.todoTitle}</p>
          <div className="flex items-center gap-1.5 mt-0.5 mb-3">
            <Briefcase className="size-3 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">{activeTimer.projectName}</p>
          </div>
          <div className="border-t border-border/40 pt-3 mb-3">
            <p className="font-mono text-[40px] font-light text-primary leading-none tracking-tight">
              {fmtTime(elapsed)}
            </p>
          </div>
          <Button variant="destructive" className="w-full gap-2" size="sm" disabled={isPending} onClick={onStop}>
            <Square className="size-2.5 fill-current" />
            Stop Timer
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-5 py-6 border-b border-border shrink-0">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center">
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[12px] font-medium text-foreground mb-0.5">No active timer</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Select a task from the left panel to start tracking time.
            </p>
          </div>
        </div>
      )}

      {/* Today's entries */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 pt-3 pb-2 sticky top-0 bg-sidebar border-b border-border/60 flex items-center justify-between">
          <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Today's entries
          </p>
          {todayEntries.length > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground">{todayEntries.length}</span>
          )}
        </div>

        {todayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
            <History className="size-7 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground/60">No entries yet today.</p>
          </div>
        ) : (
          <div>
            {todayEntries.map(e => (
              <TodayEntry key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
