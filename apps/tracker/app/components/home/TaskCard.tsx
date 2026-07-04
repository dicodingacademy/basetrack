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

  const bracketRegex = /\[([^\]]+)\]/g;
  const extractedBadges: { text: string; variant: "default" | "secondary" | "destructive" | "outline" }[] = [];
  let match;
  
  while ((match = bracketRegex.exec(task.title)) !== null) {
    const text = match[1].trim();
    if (text.toUpperCase() === "P1") {
      extractedBadges.push({ text: "HIGH", variant: "destructive" });
    } else if (text.toUpperCase() === "P2") {
      extractedBadges.push({ text: "MEDIUM", variant: "default" });
    } else if (text.toUpperCase() === "P3") {
      extractedBadges.push({ text: "LOW", variant: "secondary" });
    } else {
      extractedBadges.push({ text, variant: "outline" });
    }
  }
  
  const cleanTitle = task.title.replace(bracketRegex, "").trim();

  return (
    <div className={`group p-4 rounded-xl border flex gap-4 items-center justify-between transition-all hover:shadow-md ${isActive ? "border-primary/50 shadow-primary/10 ring-1 ring-primary/20 bg-primary/[0.02]" : "border-border/60"}`}>
      <div className="min-w-0 flex-1 pl-2 border-l-2 border-transparent group-hover:border-primary transition-colors">
        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : ""}`} title={cleanTitle}>
          {cleanTitle}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
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

          {extractedBadges.map((badge, idx) => (
            <Badge key={idx} variant={badge.variant}>{badge.text}</Badge>
          ))}
          
          {task.parent && (
            <Badge variant="secondary" className="font-normal" title={task.parent.type === "Column" ? "Column" : "To-do List"}>
              {task.parent.title}
            </Badge>
          )}
          
          {task.dueOn && (
            <div className="flex items-center text-xs text-muted-foreground gap-1" title="Deadline">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(task.dueOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
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
