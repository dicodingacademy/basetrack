import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { fmtDurationShort } from "../../lib/format";
import type { TimeEntryRow } from "../../types/tracker";

export const SOURCE_BAR: Record<string, string> = {
  BASECAMP: "bg-primary",
  GOOGLE_CALENDAR: "bg-blue-500",
  GOOGLE_TASKS: "bg-emerald-500",
};

export const STATUS_STYLE: Record<string, string> = {
  SYNCED: "bg-emerald-500/15 text-emerald-400",
  FAILED: "bg-destructive/15 text-destructive",
  NEEDS_APPROVAL: "bg-primary/15 text-primary",
  PENDING: "bg-yellow-500/15 text-yellow-400",
};

export const STATUS_LABEL: Record<string, string> = {
  SYNCED: "Synced",
  FAILED: "Failed",
  NEEDS_APPROVAL: "Needs Approval",
  PENDING: "Pending",
};

export function EntryRow({
  e,
  retryingId,
  onRetry,
}: {
  e: TimeEntryRow;
  retryingId: string | null;
  onRetry: (id: string) => void;
}) {
  const isTooShort = e.syncStatus === "FAILED" && e.durationSec < 60;
  const isRetryable = e.syncStatus === "FAILED" && e.durationSec >= 60;
  const isRetrying = retryingId === e.id;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-stretch">
        <div className={cn("w-1 shrink-0", SOURCE_BAR[e.source] ?? "bg-muted-foreground")} />
        <div className="flex flex-1 items-center gap-3.5 px-4 py-3 min-w-0">
          <div className="w-24 shrink-0">
            <p className="font-mono text-[12px] font-medium text-foreground leading-none">
              {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(e.stoppedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDurationShort(e.durationSec)}</p>
          </div>
          <div className="w-px h-7 bg-border shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate text-foreground">{e.todoTitle}</p>
            <p className="text-[11px] text-muted-foreground truncate">{e.projectName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isTooShort ? (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap"
                title="Duration too short"
              >
                Too short
              </span>
            ) : (
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", STATUS_STYLE[e.syncStatus] ?? "bg-muted text-muted-foreground")}>
                {STATUS_LABEL[e.syncStatus] ?? e.syncStatus}
              </span>
            )}
            {isRetryable && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                disabled={isRetrying}
                onClick={() => onRetry(e.id)}
              >
                {isRetrying ? "Syncing…" : "Retry"}
              </Button>
            )}
          </div>
        </div>
      </div>
      {e.syncError && !isTooShort && (
        <div className="px-5 pb-2.5 ml-1">
          <p className="text-[10.5px] text-destructive leading-snug">{e.syncError}</p>
        </div>
      )}
    </div>
  );
}
