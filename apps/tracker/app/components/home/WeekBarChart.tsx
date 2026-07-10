import { cn } from "../../lib/utils";
import { fmtDurationShort } from "../../lib/format";
import type { DailyTotal } from "../../types/tracker";

type Props = {
  dailyTotals: DailyTotal[];
  selectedDay: string | null;
  todayStr: string;
  onDayClick: (date: string) => void;
};

export function WeekBarChart({ dailyTotals, selectedDay, todayStr, onDayClick }: Props) {
  const maxSec = Math.max(1, ...dailyTotals.map(d => d.totalSec));

  return (
    <div className="flex gap-1">
      {dailyTotals.map(d => {
        const label = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const isSelected = selectedDay === d.date;
        const isToday = d.date === todayStr;
        const active = isSelected || (!selectedDay && isToday);
        const barH = d.totalSec > 0 ? Math.max(6, Math.round((d.totalSec / maxSec) * 44)) : 2;

        return (
          <button
            key={d.date}
            onClick={() => onDayClick(selectedDay === d.date ? "" : d.date)}
            className="flex-1 flex flex-col items-center gap-1.5 group"
          >
            <div className="w-full flex flex-col justify-end" style={{ height: 44 }}>
              <div
                title={d.totalSec > 0 ? fmtDurationShort(d.totalSec) : undefined}
                className={cn(
                  "w-full rounded-sm transition-all",
                  active ? "bg-primary" : d.totalSec > 0 ? "bg-primary/60" : "bg-muted-foreground/20"
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
        );
      })}
    </div>
  );
}
