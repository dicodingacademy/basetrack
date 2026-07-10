import { useState } from "react";
import { cn } from "../../lib/utils";
import { fmtDurationShort } from "../../lib/format";
import type { DailyTotal, TimeEntryRow } from "../../types/tracker";

type Props = {
  dailyTotals: DailyTotal[];
  entries: TimeEntryRow[];
  selectedDay: string | null;
  todayStr: string;
  onDayClick: (date: string) => void;
};

export function WeekBarChart({ dailyTotals, entries, selectedDay, todayStr, onDayClick }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const maxSec = Math.max(1, ...dailyTotals.map(d => d.totalSec));

  return (
    <div className="flex gap-1">
      {dailyTotals.map((d, i) => {
        const label = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const isSelected = selectedDay === d.date;
        const isToday = d.date === todayStr;
        const active = isSelected || (!selectedDay && isToday);
        const isHovered = hoveredDate === d.date;
        const barH = d.totalSec > 0 ? Math.max(6, Math.round((d.totalSec / maxSec) * 44)) : 2;

        const dayEntries = entries.filter(e => new Date(e.startedAt).toLocaleDateString("en-CA") === d.date);

        // Align tooltip: left for first cols, right for last cols, center for middle
        const tooltipAlign =
          i < 2
            ? "left-0"
            : i > dailyTotals.length - 3
            ? "right-0"
            : "left-1/2 -translate-x-1/2";

        return (
          <div
            key={d.date}
            className="relative flex-1 flex flex-col items-center gap-1.5 group"
            onMouseEnter={() => setHoveredDate(d.date)}
            onMouseLeave={() => setHoveredDate(null)}
          >
            {/* Hover tooltip */}
            {isHovered && (
              <div className={cn(
                "absolute bottom-full mb-2.5 z-50 w-52 rounded-xl border bg-popover shadow-xl p-3",
                tooltipAlign
              )}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {d.totalSec > 0 && (
                    <span className="ml-1.5 font-mono normal-case tracking-normal text-foreground">
                      {fmtDurationShort(d.totalSec)}
                    </span>
                  )}
                </p>
                {dayEntries.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60">No entries</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayEntries.slice(0, 6).map(e => (
                      <div key={e.id} className="flex items-center gap-2">
                        <p className="text-[11px] truncate flex-1 text-foreground">{e.todoTitle}</p>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {fmtDurationShort(e.durationSec)}
                        </span>
                      </div>
                    ))}
                    {dayEntries.length > 6 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        +{dayEntries.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bar + label (clickable) */}
            <button
              onClick={() => onDayClick(selectedDay === d.date ? "" : d.date)}
              className="w-full flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div className="w-full flex flex-col justify-end" style={{ height: 44 }}>
                <div
                  className={cn(
                    "w-full rounded-sm transition-all",
                    active
                      ? "bg-primary"
                      : isHovered && d.totalSec > 0
                      ? "bg-primary/75"
                      : d.totalSec > 0
                      ? "bg-primary/60"
                      : "bg-muted-foreground/20"
                  )}
                  style={{ height: barH }}
                />
              </div>
              <span className={cn(
                "text-[9px] font-medium leading-none transition-colors",
                isSelected ? "text-primary" : isToday ? "text-primary/80" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {label}
              </span>
              {d.count > 0 && (
                <span className={cn("size-1 rounded-full -mt-0.5", active ? "bg-primary" : "bg-primary/60")} />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
