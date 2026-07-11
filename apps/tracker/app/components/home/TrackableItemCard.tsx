import { Button } from "../ui/button";
import { Play } from "lucide-react";
import { EventCard } from "./EventCard";
import { ProjectPickerModal } from "./ProjectPickerModal";
import type { TrackableItem } from "../../integrations/types";
import type { StartTimerData } from "../../hooks/useTimerWebSocket";

type Props = {
  item: TrackableItem;
  projects: { id: string; name: string }[];
  isActive: boolean;
  onStart: (d: StartTimerData) => void;
  onStop: () => void;
  isPending: boolean;
};

export function TrackableItemCard({ item, projects, isActive, onStart, onStop, isPending }: Props) {
  const handleSelect = async (project: { id: string; name: string }) => {
    const res = await fetch(`/api/check-timesheet?projectId=${project.id}`);
    const { available } = await res.json();
    if (!available) {
      throw new Error(
        "Project ini belum punya time entry di Basecamp. Log minimal satu time entry manual di Basecamp untuk project ini terlebih dahulu."
      );
    }
    onStart({
      todoId: item.id,
      todoTitle: item.title,
      projectId: project.id,
      projectName: project.name,
      source: item.source,
    });
  };

  const startSlot = item.nativeProjectId ? (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => onStart({
        todoId: item.id,
        todoTitle: item.title,
        projectId: item.nativeProjectId!,
        projectName: item.nativeProjectName ?? "",
        source: item.source,
      })}
      className="gap-1.5"
    >
      <Play className="size-2.5 fill-current" />
      Start
    </Button>
  ) : (
    <ProjectPickerModal projects={projects} onSelect={handleSelect}>
      <Button variant="outline" size="sm" disabled={isPending} className="gap-1.5">
        <Play className="size-2.5 fill-current" />
        Start
      </Button>
    </ProjectPickerModal>
  );

  return (
    <EventCard
      isActive={isActive}
      timeLabel={item.timeLabel ?? "—"}
      typeLabel={item.type}
      title={item.title}
      tags={item.subtitle ? [item.subtitle] : item.tags}
      isPending={isPending}
      onStop={onStop}
      startSlot={startSlot}
    />
  );
}
