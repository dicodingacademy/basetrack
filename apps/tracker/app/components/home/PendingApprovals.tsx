import { useFetcher } from "react-router";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import type { TimeEntry } from "@prisma/client";

type PendingApprovalProps = {
  approvals: TimeEntry[];
};

function ApprovalRow({ entry }: { entry: TimeEntry }) {
  const fetcher = useFetcher<{ success: boolean; status: string }>();
  const isSubmitting = fetcher.state !== "idle";
  const hours = (entry.durationSec / 3600).toFixed(2);

  return (
    <div className="bg-card p-4 rounded-lg border border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
      <div>
        <p className="font-medium text-foreground">{entry.todoTitle}</p>
        <p className="text-sm text-muted-foreground">{entry.projectName}</p>
        <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Started: {new Date(entry.startedAt).toLocaleString()}
        </p>
      </div>
      <fetcher.Form method="post" className="flex items-center gap-3">
        <input type="hidden" name="intent" value="APPROVE_TIMER" />
        <input type="hidden" name="entryId" value={entry.id} />

        <div className="flex flex-col gap-1 w-24">
          <Label htmlFor={`duration-${entry.id}`} className="text-xs text-muted-foreground">Hours</Label>
          <Input
            id={`duration-${entry.id}`}
            name="durationHours"
            type="number"
            step="0.01"
            min="0"
            defaultValue={hours}
            disabled={isSubmitting}
            className="h-8 text-sm"
          />
        </div>

        <Button type="submit" size="sm" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white mt-5">
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing…
            </>
          ) : (
            "Approve & Sync"
          )}
        </Button>
      </fetcher.Form>
    </div>
  );
}

export function PendingApprovals({ approvals }: PendingApprovalProps) {
  if (approvals.length === 0) return null;

  return (
    <Card className="shadow-sm border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10 mb-6">
      <CardHeader>
        <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Pending Approvals
        </CardTitle>
        <CardDescription className="text-amber-600 dark:text-amber-500">
          The following timers were automatically stopped. Please verify the duration and approve them to sync with Basecamp.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {approvals.map((entry) => (
          <ApprovalRow key={entry.id} entry={entry} />
        ))}
      </CardContent>
    </Card>
  );
}
