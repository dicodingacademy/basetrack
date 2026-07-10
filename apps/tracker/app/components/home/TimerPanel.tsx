import { useEffect } from "react";
import { useFetcher } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Clock, Square } from "lucide-react";
import { fmtTime, fmtDurationShort } from "../../lib/format";
import type { ActiveTimer, TodayFetcherData } from "../../types/tracker";

export function TimerPanel({ activeTimer, elapsed, onStop, isPending }: {
  activeTimer: ActiveTimer | null;
  elapsed: number;
  onStop: () => void;
  isPending: boolean;
}) {
  const todayFetcher = useFetcher<TodayFetcherData>();

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    todayFetcher.load(`/api/time-entries?mode=daily&date=${today}`);
  }, [activeTimer?.startedAt]);

  const todayTotalSec: number = todayFetcher.data?.totalSec ?? 0;

  return (
    <div className="w-[270px] h-full border-l bg-sidebar flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-3.5 border-b border-border">
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
            <Button variant="destructive" className="w-full gap-2" size="sm" disabled={isPending} onClick={onStop}>
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
