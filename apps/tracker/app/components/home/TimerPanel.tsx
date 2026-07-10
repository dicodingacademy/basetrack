import { useEffect } from "react";
import { useFetcher } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Clock, Square, Briefcase, Calendar, ListTodo, History } from "lucide-react";
import { fmtTime, fmtDurationShort } from "../../lib/format";
import type { ActiveTimer, HistoryFetcherData, TimeEntryRow } from "../../types/tracker";

const STATUS_DOT: Record<string, string> = {
  SYNCED: "bg-green-500",
  FAILED: "bg-red-500",
  NEEDS_APPROVAL: "bg-amber-400",
  PENDING: "bg-muted-foreground/50",
};

const SOURCE_ICON: Record<string, React.ElementType> = {
  BASECAMP: Briefcase,
  GOOGLE_CALENDAR: Calendar,
  GOOGLE_TASKS: ListTodo,
};

function TodayEntry({ e }: { e: TimeEntryRow }) {
  const Icon = SOURCE_ICON[e.source] ?? Briefcase;
  const dot = STATUS_DOT[e.syncStatus] ?? "bg-muted-foreground/50";

  const start = new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const end = new Date(e.stoppedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 border-b border-border/60 last:border-0">
      <div className="mt-1 shrink-0">
        <span className={cn("block size-1.5 rounded-full", dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] font-medium leading-snug truncate">{e.todoTitle}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate">{e.projectName}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">{start} – {end}</p>
      </div>
      <span className="text-[10.5px] font-mono text-muted-foreground shrink-0 mt-0.5">
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

  return (
    <div className="w-[270px] h-full border-l bg-sidebar flex flex-col overflow-hidden">
      {/* Today total */}
      <div className="px-5 pt-4 pb-3.5 border-b border-border shrink-0">
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1.5">Today</p>
        <div className="flex items-baseline gap-2">
          <p className={cn("font-mono text-lg font-semibold leading-none", todayTotalSec > 0 ? "text-foreground" : "text-muted-foreground")}>
            {fmtDurationShort(todayTotalSec)}
          </p>
          {activeTimer && (
            <span className="text-[10px] text-primary">+ running</span>
          )}
        </div>
      </div>

      {/* Active timer or idle state */}
      {activeTimer ? (
        <>
          <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Running</p>
            <p className="font-mono text-[46px] font-light text-primary leading-none mt-2 mb-1.5 tracking-tight">
              {fmtTime(elapsed)}
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug mb-4 truncate">
              {activeTimer.todoTitle}
            </p>
            <Button variant="destructive" className="w-full gap-2" size="sm" disabled={isPending} onClick={onStop}>
              <Square className="size-2.5 fill-current" />
              Stop Timer
            </Button>
          </div>
          <div className="px-5 py-3 border-b border-border shrink-0">
            <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1">Project</p>
            <p className="text-[11.5px] text-muted-foreground truncate">{activeTimer.projectName}</p>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="size-8 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
            <Clock className="size-3.5" />
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug">
            No timer running.<br />Pick an item to track.
          </p>
        </div>
      )}

      {/* Today's entries */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-5 pt-3.5 pb-2 sticky top-0 bg-sidebar border-b border-border/60">
          <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Today's entries
            {todayEntries.length > 0 && (
              <span className="ml-1.5 font-mono">{todayEntries.length}</span>
            )}
          </p>
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
