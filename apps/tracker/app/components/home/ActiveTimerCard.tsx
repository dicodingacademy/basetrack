import { Form } from "react-router";
import { Clock, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { LiveTimer } from "./LiveTimer";

import type { ActiveTimerType } from "../../types/basecamp";

type ActiveTimerProps = {
  activeTimer: ActiveTimerType | null;
};

export function ActiveTimerCard({ activeTimer }: ActiveTimerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Active Timer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeTimer ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate">
                {activeTimer.projectName}
              </p>
              <p className="text-sm font-medium leading-tight">
                {activeTimer.todoTitle}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-2xl font-mono font-bold tracking-tighter text-primary">
                <LiveTimer startedAt={activeTimer.startedAt} />
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="STOP_TIMER" />
                <Button type="submit" variant="destructive" size="sm">
                  <Square className="w-4 h-4 mr-2 fill-current" />
                  Stop
                </Button>
              </Form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mb-4 opacity-20" />
            <p className="text-sm font-medium text-foreground">No active timer</p>
            <p className="text-xs mt-1">Select a task on the left to start tracking.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
