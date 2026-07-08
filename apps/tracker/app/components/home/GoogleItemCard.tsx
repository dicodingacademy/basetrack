import { useState } from "react";
import { Play, Calendar, CheckSquare, Clock, Square } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ProjectPickerModal } from "./ProjectPickerModal";
import type { GoogleCalendarEvent, GoogleTask, TimerSource } from "../../types/google";
import type { StartTimerData } from "../../hooks/useTimerWebSocket";

type GoogleItemProps = {
  item: GoogleCalendarEvent | GoogleTask;
  source: TimerSource;
  projects: { id: string; name: string }[];
  isActive: boolean;
  onStart: (data: StartTimerData) => void;
  onStop: () => void;
  isPending: boolean;
};

export function GoogleItemCard({ item, source, projects, isActive, onStart, onStop, isPending }: GoogleItemProps) {
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const isCalendar = source === "GOOGLE_CALENDAR";
  const displayTitle = isCalendar
    ? (item as GoogleCalendarEvent).summary || "Untitled Event"
    : (item as GoogleTask).title || "Untitled Task";

  const formatTime = (item: GoogleCalendarEvent) => {
    if (item.start.dateTime) {
      return new Date(item.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return "All day";
  };

  const formatDue = (task: GoogleTask) => {
    if (task.due) return new Date(task.due).toLocaleDateString();
    return null;
  };

  const handleSelect = async (project: { id: string; name: string }) => {
    const res = await fetch(`/api/check-timesheet?projectId=${project.id}`);
    const { available } = await res.json();
    if (!available) {
      throw new Error(
        "Project ini belum punya time entry di Basecamp. Log minimal satu time entry manual di Basecamp untuk project ini terlebih dahulu."
      );
    }
    setSelectedProject(project);
    onStart({
      todoId: item.id,
      todoTitle: displayTitle,
      projectId: project.id,
      projectName: project.name,
      source,
    });
  };

  return (
    <div className={`group p-4 rounded-xl border flex gap-4 items-center justify-between transition-all hover:shadow-md overflow-hidden ${isActive ? "border-primary/50 shadow-primary/10 ring-1 ring-primary/20 bg-primary/[0.02]" : "border-border/60"}`}>
      <div className="min-w-0 flex-1 pl-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {isCalendar ? (
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
          ) : (
            <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {isCalendar ? "Calendar" : "Task"}
          </Badge>
          <p className={`min-w-0 text-sm font-semibold truncate ${isActive ? "text-primary" : ""}`} title={displayTitle}>
            {displayTitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {isCalendar ? (
            <div className="flex items-center text-xs text-muted-foreground gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(item as GoogleCalendarEvent)}</span>
            </div>
          ) : (
            <>
              {formatDue(item as GoogleTask) && (
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDue(item as GoogleTask)}</span>
                </div>
              )}
              {selectedProject && (
                <Badge variant="outline" className="text-[10px]">
                  {selectedProject.name}
                </Badge>
              )}
            </>
          )}

          {isActive && (
            <span className="flex h-2 w-2 relative ml-1" title="Currently tracking">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {isActive ? (
          <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onStop}>
            <Square className="w-3.5 h-3.5 mr-2 fill-current" />
            Stop
          </Button>
        ) : (
          <ProjectPickerModal
            projects={projects}
            onSelect={handleSelect}
          >
            <Button variant="outline" size="sm" disabled={isPending}>
              <Play className="w-3.5 h-3.5 mr-2" />
              Start Timer
            </Button>
          </ProjectPickerModal>
        )}
      </div>
    </div>
  );
}
