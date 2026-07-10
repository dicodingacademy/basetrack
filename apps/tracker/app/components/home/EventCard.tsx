import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Square, Play } from "lucide-react";
import { ProjectPickerModal } from "./ProjectPickerModal";
import type { GroupedTask } from "../../types/basecamp";
import type { ActiveTimer } from "../../types/tracker";
import type { GoogleCalendarEvent, GoogleTask } from "../../types/google";
import type { StartTimerData } from "../../hooks/useTimerWebSocket";

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

export function EventCard({ isActive, timeLabel, typeLabel, title, tags, isPending, onStop, startSlot }: EventCardProps) {
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

export function BasecampTaskCard({ task, projectId, projectName, activeTimer, onStart, onStop, isPending }: {
  task: GroupedTask;
  projectId: string;
  projectName: string;
  activeTimer: ActiveTimer | null;
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

export function GoogleEventCard({ item, source, projects, isActive, onStart, onStop, isPending }: {
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
