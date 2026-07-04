import { Form } from "react-router";
import { Play, Clock, Calendar } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup } from "../../components/ui/avatar";
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
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="secondary">{task.type}</Badge>
          
          {task.dueOn && (
            <div className="flex items-center text-xs text-muted-foreground gap-1" title="Deadline">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(task.dueOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
          )}

          {task.assignees && task.assignees.length > 0 && (
            <AvatarGroup className="-space-x-1.5" title={task.assignees.map(a => a.name).join(", ")}>
              {task.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.id} size="sm" className="ring-2 ring-background border-none w-5 h-5">
                  <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                  <AvatarFallback className="text-[9px] font-medium">{assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
              {task.assignees.length > 3 && (
                <div className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-background">
                  +{task.assignees.length - 3}
                </div>
              )}
            </AvatarGroup>
          )}

          {isActive && (
            <span className="flex h-2 w-2 relative ml-1" title="Currently tracking">
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
