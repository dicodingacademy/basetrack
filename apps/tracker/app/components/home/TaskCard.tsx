import { Form } from "react-router";
import { Play, Clock } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { LiveTimer } from "./LiveTimer";

import type { GroupedTask, GroupedAssignment, ActiveTimerType } from "../../types/basecamp";

type TaskProps = {
  task: GroupedTask;
  selectedProject: GroupedAssignment;
  activeTimer: ActiveTimerType | null;
};

export function TaskCard({ task, selectedProject, activeTimer }: TaskProps) {
  const isActive = activeTimer?.todoId === task.id;

  return (
    <div className="p-4 rounded-xl border flex gap-4 items-center justify-between hover:bg-muted/50 transition-colors group">
      <div className="min-w-0 flex-1 pl-2 border-l-2 border-transparent group-hover:border-primary transition-colors">
        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : ""}`} title={task.title}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant="secondary">{task.type}</Badge>
          {isActive && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </div>
      </div>
      <Form
        method="post"
        className={`shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
      >
        <input type="hidden" name="intent" value="START_TIMER" />
        <input type="hidden" name="todoId" value={task.id} />
        <input type="hidden" name="todoTitle" value={task.title} />
        <input type="hidden" name="projectId" value={selectedProject.projectId} />
        <input type="hidden" name="projectName" value={selectedProject.projectName} />
        <Button type="submit" disabled={isActive} variant={isActive ? "secondary" : "default"} size="sm">
          {isActive ? (
            <>
              <Clock className="w-3.5 h-3.5 mr-2 animate-pulse" />
              <LiveTimer startedAt={activeTimer!.startedAt} />
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 mr-2" />
              <span>Start Timer</span>
            </>
          )}
        </Button>
      </Form>
    </div>
  );
}
