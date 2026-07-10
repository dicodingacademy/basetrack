type TimelineEntry = {
  startedAt: string;
  stoppedAt: string;
  source?: string;
};

export function HourHeatmap({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div>
      <div className="relative h-4 rounded bg-foreground/8 overflow-hidden">
        {entries.map((e, i) => {
          const start = new Date(e.startedAt);
          const end = new Date(e.stoppedAt);
          const startMin = start.getHours() * 60 + start.getMinutes();
          const endMin = end.getHours() * 60 + end.getMinutes();
          const left = (startMin / 1440) * 100;
          const width = Math.max(0.3, ((endMin - startMin) / 1440) * 100);
          const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div
              key={i}
              className="absolute top-0 h-full bg-primary"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${startLabel} – ${endLabel}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        {["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"].map((l, i) => (
          <span key={i} className="text-[9px] text-muted-foreground">{l}</span>
        ))}
      </div>
    </div>
  );
}
