import { useEffect, useRef, useState } from "react";
import { useFetcher, useOutletContext, redirect } from "react-router";
import type { Route } from "./+types/dashboard._index";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { getPendingApprovals, approveTimeEntry } from "../services/timer.server";
import { PendingApprovals } from "../components/home/PendingApprovals";
import { HourHeatmap } from "../components/home/HourHeatmap";
import { WeekBarChart } from "../components/home/WeekBarChart";
import { EntryRow } from "../components/home/EntryRow";
import { fmtDurationShort, fmtTime } from "../lib/format";
import { cn } from "../lib/utils";
import { Clock, Radio } from "lucide-react";
import type { DashboardContext } from "./dashboard";
import type { HistoryFetcherData, TimeEntryRow } from "../types/tracker";

export function meta() {
  return [{ title: "Basetrack - Overview" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");
  return { pendingApprovals: await getPendingApprovals(user.id) };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");

  const form = await request.formData();
  if (form.get("intent") === "APPROVE_TIMER") {
    const entryId = form.get("entryId") as string;
    const durationHours = parseFloat(form.get("durationHours") as string);
    if (!entryId || !Number.isFinite(durationHours) || durationHours <= 0) return { ok: false };
    return approveTimeEntry(user.id, entryId, user.basecampAccountId, Math.round(durationHours * 3600), user.timezone);
  }
  return { ok: false };
}

function RunningNow() {
  const { activeTimer } = useOutletContext<DashboardContext>();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const start = new Date(activeTimer.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeTimer?.startedAt]);

  if (!activeTimer) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-center gap-4">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Clock className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No timer running</p>
          <p className="text-xs text-muted-foreground">
            Start a timer from the Basecamp extension or the desktop app — it will appear here live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="size-2 rounded-full bg-primary animate-live-pulse" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Running now</span>
      </div>
      <p className="text-base font-semibold truncate">{activeTimer.todoTitle}</p>
      <div className="flex items-center gap-1.5 mt-0.5 mb-4">
        <Radio className="size-3 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground truncate">{activeTimer.projectName} · {activeTimer.source}</p>
      </div>
      <p className="font-mono text-4xl font-light text-primary leading-none tracking-tight">{fmtTime(elapsed)}</p>
    </div>
  );
}

function TodaySection() {
  const fetcher = useFetcher<HistoryFetcherData>();
  const retryFetcher = useFetcher<{ success: boolean }>();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetcher.load(`/api/time-entries?mode=daily&date=${new Date().toLocaleDateString("en-CA")}`);
  }, []);
  useEffect(() => {
    if (retryFetcher.state === "idle" && retryingId !== null) setRetryingId(null);
  }, [retryFetcher.state]);

  const data = fetcher.data;
  const entries: TimeEntryRow[] = data?.entries ?? [];

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Today</p>
        <span className="font-mono text-sm font-semibold">{fmtDurationShort(data?.totalSec ?? 0)}</span>
      </div>
      {data?.timeline && <HourHeatmap entries={data.timeline} />}
      <div className="mt-3 flex flex-col gap-2">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No entries yet today.</p>
        ) : (
          entries.slice(0, 6).map(e => (
            <EntryRow
              key={e.id}
              e={e}
              retryingId={retryingId}
              onRetry={(id) => { setRetryingId(id); retryFetcher.submit({ entryId: id }, { method: "post", action: "/api/time-entries/retry" }); }}
            />
          ))
        )}
      </div>
    </section>
  );
}

function WeekSection() {
  const fetcher = useFetcher<HistoryFetcherData>();
  useEffect(() => {
    fetcher.load(`/api/time-entries?mode=weekly&date=${new Date().toLocaleDateString("en-CA")}`);
  }, []);
  const data = fetcher.data;
  const todayStr = new Date().toLocaleDateString("en-CA");
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">This week</p>
        <span className="font-mono text-sm font-semibold">{fmtDurationShort(data?.weekTotalSec ?? 0)}</span>
      </div>
      {data?.dailyTotals ? (
        <WeekBarChart dailyTotals={data.dailyTotals} entries={data.entries ?? []} selectedDay={null} todayStr={todayStr} onDayClick={() => {}} />
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      )}
    </section>
  );
}

export default function OverviewPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className={cn("space-y-5")}>
      <RunningNow />
      {loaderData.pendingApprovals.length > 0 && <PendingApprovals approvals={loaderData.pendingApprovals} />}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TodaySection />
        <WeekSection />
      </div>
    </div>
  );
}
