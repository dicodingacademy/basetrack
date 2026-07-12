import {
  BarChart, Bar, XAxis, YAxis, Cell, LabelList,
  PieChart, Pie,
} from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../ui/chart";
import { cn } from "../../lib/utils";
import { fmtDurationShort } from "../../lib/format";
import { Flame, Target, TrendingUp } from "lucide-react";
import type { HistoryFetcherData, TimeEntryRow, DailyTotal } from "../../types/tracker";

// ── static config ─────────────────────────────────────────────────────────────

const BAR_CONFIG: ChartConfig = {
  totalSec: { label: "Time tracked", color: "var(--primary)" },
  sec:      { label: "Time tracked", color: "var(--primary)" },
};

const SOURCE_COLORS: Record<string, string> = {
  BASECAMP:        "var(--primary)",
  GOOGLE_CALENDAR: "#3b82f6",
  GOOGLE_TASKS:    "#22c55e",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (i: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function computeStreaks(dailyTotals: DailyTotal[], todayStr: string) {
  const active = new Set(dailyTotals.filter(d => d.count > 0).map(d => d.date));
  const sorted = dailyTotals.map(d => d.date).sort();
  let longest = 0, cur = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (active.has(sorted[i])) {
      if (i === 0) { cur = 1; }
      else {
        const prev = new Date(sorted[i - 1] + "T12:00:00");
        prev.setDate(prev.getDate() + 1);
        cur = prev.toISOString().split("T")[0] === sorted[i] ? cur + 1 : 1;
      }
      if (cur > longest) longest = cur;
    } else { cur = 0; }
  }
  const anchor = sorted.includes(todayStr) ? todayStr : sorted[sorted.length - 1];
  let current = 0;
  if (anchor && active.has(anchor)) {
    current = 1;
    const anchorIdx = sorted.indexOf(anchor);
    for (let i = anchorIdx - 1; i >= 0; i--) {
      const next = new Date(sorted[i + 1] + "T12:00:00");
      next.setDate(next.getDate() - 1);
      if (next.toISOString().split("T")[0] === sorted[i] && active.has(sorted[i])) current++;
      else break;
    }
  }
  return { longest, current };
}

function computeWeeks(dailyTotals: DailyTotal[]) {
  const weeks: { label: string; totalSec: number; activeDays: number; days: DailyTotal[] }[] = [];
  let wi = 0;
  for (let i = 0; i < dailyTotals.length; i++) {
    const dow = new Date(dailyTotals[i].date + "T12:00:00").getDay();
    if (i === 0 || dow === 1) { wi = weeks.length; weeks.push({ label: `W${weeks.length + 1}`, totalSec: 0, activeDays: 0, days: [] }); }
    weeks[wi].days.push(dailyTotals[i]);
    weeks[wi].totalSec += dailyTotals[i].totalSec;
    if (dailyTotals[i].count > 0) weeks[wi].activeDays++;
  }
  return weeks;
}

function computeWeekdayTotals(entries: TimeEntryRow[]) {
  const secs = Array(7).fill(0), counts = Array(7).fill(0);
  for (const e of entries) { const d = new Date(e.startedAt).getDay(); secs[d] += e.durationSec; counts[d]++; }
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, i) => ({ label, totalSec: secs[i], count: counts[i] }));
}

function computeHourDistribution(entries: TimeEntryRow[]) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sec: 0 }));
  for (const e of entries) buckets[new Date(e.startedAt).getHours()].sec += e.durationSec;
  return buckets;
}

// ── shared tooltip ────────────────────────────────────────────────────────────

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: unknown; payload?: unknown }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const sec = Number(payload[0]?.value ?? 0);
  if (!sec) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-0.5">{label}</p>}
      <p className="font-mono font-medium text-foreground">{fmtDurationShort(sec)}</p>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "bg-primary/8 border-primary/20" : "bg-card")}>
      <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-mono text-base font-semibold leading-none", accent && "text-primary")}>{value}</p>
      {sub && <p className="text-[9.5px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function ConsistencyRing({ activeDays, totalDays }: { activeDays: number; totalDays: number }) {
  const pct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
  const grade = pct >= 80 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : pct >= 20 ? "D" : "F";
  const gradeColor = pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-primary" : pct >= 40 ? "text-amber-500" : "text-red-500";
  const r = 18, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <div className="flex items-center gap-2.5">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="stroke-primary" />
      </svg>
      <div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-bold font-mono leading-none", gradeColor)}>{grade}</span>
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
        <p className="text-[9.5px] text-muted-foreground mt-0.5">{activeDays}/{totalDays} days active</p>
      </div>
    </div>
  );
}

// ── charts ────────────────────────────────────────────────────────────────────

function DailyChart({ dailyTotals, todayStr }: { dailyTotals: DailyTotal[]; todayStr: string }) {
  const bestDate = dailyTotals.reduce((b, d) => d.totalSec > (b?.totalSec ?? 0) ? d : b, null as DailyTotal | null)?.date;
  const data = dailyTotals.map(d => ({ ...d, dayNum: parseInt(d.date.split("-")[2]) }));
  return (
    <ChartContainer config={BAR_CONFIG} className="h-[140px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="12%">
        <XAxis
          dataKey="dayNum"
          tick={({ x, y, payload }: any) => {
            const v = Number(payload?.value);
            if (![1, 8, 15, 22, 29].includes(v)) return <g />;
            return <text x={x} y={y + 4} textAnchor="middle" style={{ fill: "var(--foreground)", fontSize: 9 }}>{v}</text>;
          }}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DailyTotal & { dayNum: number };
            if (!d.totalSec) return null;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="text-muted-foreground mb-0.5">{d.date}</p>
                <p className="font-mono font-medium text-foreground">{fmtDurationShort(d.totalSec)}</p>
                <p className="text-muted-foreground mt-0.5">{d.count} {d.count === 1 ? "entry" : "entries"}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="totalSec" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill="var(--color-totalSec)"
              fillOpacity={
                d.date === bestDate ? 1
                : d.totalSec > 0 ? 0.75
                : 0.12
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function WeekChart({ dailyTotals }: { dailyTotals: DailyTotal[] }) {
  const weeks = computeWeeks(dailyTotals);
  const data = weeks.map(w => ({
    label: w.label,
    totalSec: w.totalSec,
    activeDays: w.activeDays,
    range: [
      w.days[0] && new Date(w.days[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      w.days[w.days.length - 1] && new Date(w.days[w.days.length - 1].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ].filter(Boolean).join(" – "),
  }));
  return (
    <ChartContainer config={BAR_CONFIG} className="h-[130px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={({ x, y, payload }: any) => (
            <text x={x} y={y + 4} textAnchor="middle" style={{ fill: "var(--foreground)", fontSize: 10 }}>{payload?.value}</text>
          )}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="font-medium mb-1">{d.label} <span className="text-muted-foreground font-normal">({d.range})</span></p>
                <p className="font-mono text-foreground">{fmtDurationShort(d.totalSec)}</p>
                <p className="text-muted-foreground mt-0.5">{d.activeDays} active days</p>
              </div>
            );
          }}
        />
        <Bar dataKey="totalSec" fill="var(--color-totalSec)" fillOpacity={0.9} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function WeekdayChart({ entries }: { entries: TimeEntryRow[] }) {
  const DOW = [1, 2, 3, 4, 5, 6, 0];
  const all = computeWeekdayTotals(entries);
  const data = DOW.map(i => all[i]);
  return (
    <ChartContainer config={BAR_CONFIG} className="h-[130px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={({ x, y, payload }: any) => (
            <text x={x} y={y + 4} textAnchor="middle" style={{ fill: "var(--foreground)", fontSize: 9 }}>{payload?.value}</text>
          )}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            if (!d.totalSec) return null;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="text-muted-foreground mb-0.5">{d.label}</p>
                <p className="font-mono text-foreground">{fmtDurationShort(d.totalSec)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="totalSec" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill="var(--color-totalSec)" fillOpacity={d.totalSec > 0 ? 0.85 : 0.12} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function HourChart({ entries }: { entries: TimeEntryRow[] }) {
  const LABELS: Record<number, string> = { 0: "12a", 6: "6a", 12: "12p", 18: "6p" };
  const data = computeHourDistribution(entries);
  const hourConfig: ChartConfig = { sec: { label: "Time", color: "var(--primary)" } };
  return (
    <ChartContainer config={hourConfig} className="h-[90px] w-full aspect-auto">
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="8%">
        <XAxis
          dataKey="hour"
          tick={({ x, y, payload }: any) => {
            const label = LABELS[Number(payload?.value)];
            if (!label) return <g />;
            return <text x={x} y={y + 4} textAnchor="middle" style={{ fill: "var(--foreground)", fontSize: 9 }}>{label}</text>;
          }}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            if (!d.sec) return null;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="text-muted-foreground mb-0.5">{d.hour}:00 – {d.hour + 1}:00</p>
                <p className="font-mono text-foreground">{fmtDurationShort(d.sec)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="sec" radius={[2, 2, 0, 0]}>
          {data.map((b, i) => (
            <Cell key={i} fill="var(--color-sec)" fillOpacity={b.sec > 0 ? 0.85 : 0.1} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function TasksChart({
  tasks, monthTotalSec,
}: { tasks: Array<{ name: string; totalSec: number; count: number }>; monthTotalSec: number }) {
  const maxSec = tasks[0]?.totalSec ?? 1;
  const h = tasks.length * 36 + 8;
  return (
    <ChartContainer config={BAR_CONFIG} className="w-full aspect-auto" style={{ height: h }}>
      <BarChart layout="vertical" data={tasks} margin={{ top: 0, right: 72, bottom: 0, left: 4 }}>
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={({ x, y, payload }: any) => {
            const v = String(payload?.value ?? "");
            const label = v.length > 22 ? v.slice(0, 22) + "…" : v;
            return <text x={x - 4} y={y} dominantBaseline="central" textAnchor="end" style={{ fill: "var(--foreground)", fontSize: 10 }}>{label}</text>;
          }}
          axisLine={false}
          tickLine={false}
        />
        <XAxis type="number" hide domain={[0, maxSec * 1.6]} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl max-w-[200px]">
                <p className="font-medium mb-1 break-words leading-snug">{d.name}</p>
                <p className="font-mono text-foreground">{fmtDurationShort(d.totalSec)}</p>
                <p className="text-muted-foreground mt-0.5">{d.count}× · {Math.round((d.totalSec / monthTotalSec) * 100)}% of total</p>
              </div>
            );
          }}
        />
        <Bar dataKey="totalSec" fill="var(--color-totalSec)" fillOpacity={0.9} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="totalSec"
            position="right"
            content={(props) => {
              const { x, y, width, height, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: unknown };
              if (!value) return null;
              return (
                <text
                  x={Number(x) + Number(width) + 5}
                  y={Number(y) + Number(height) / 2}
                  dominantBaseline="central"
                  fontSize={9}
                  fill="var(--foreground)"
                >
                  {fmtDurationShort(Number(value))}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function ProjectsChart({
  projects, monthTotalSec,
}: { projects: Array<{ name: string; totalSec: number; count: number }>; monthTotalSec: number }) {
  const maxSec = projects[0]?.totalSec ?? 1;
  const h = projects.length * 36 + 8;
  const projConfig: ChartConfig = { totalSec: { label: "Time", color: "var(--primary)" } };
  return (
    <ChartContainer config={projConfig} className="w-full aspect-auto" style={{ height: h }}>
      <BarChart layout="vertical" data={projects} margin={{ top: 0, right: 72, bottom: 0, left: 4 }}>
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={({ x, y, payload }: any) => {
            const v = String(payload?.value ?? "");
            const label = v.length > 18 ? v.slice(0, 18) + "…" : v;
            return <text x={x - 4} y={y} dominantBaseline="central" textAnchor="end" style={{ fill: "var(--foreground)", fontSize: 10 }}>{label}</text>;
          }}
          axisLine={false}
          tickLine={false}
        />
        <XAxis type="number" hide domain={[0, maxSec * 1.6]} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <p className="font-medium mb-1 break-words">{d.name}</p>
                <p className="font-mono text-foreground">{fmtDurationShort(d.totalSec)}</p>
                <p className="text-muted-foreground mt-0.5">{Math.round((d.totalSec / monthTotalSec) * 100)}% of total</p>
              </div>
            );
          }}
        />
        <Bar dataKey="totalSec" fill="var(--color-totalSec)" fillOpacity={0.85} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="totalSec"
            position="right"
            content={(props) => {
              const { x, y, width, height, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: unknown };
              if (!value) return null;
              return (
                <text
                  x={Number(x) + Number(width) + 5}
                  y={Number(y) + Number(height) / 2}
                  dominantBaseline="central"
                  fontSize={9}
                  fill="var(--foreground)"
                >
                  {fmtDurationShort(Number(value))}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function SourceDonut({
  sources, monthTotalSec,
}: { sources: Array<{ key: string; label: string; sec: number }>; monthTotalSec: number }) {
  const pieConfig: ChartConfig = Object.fromEntries(
    sources.map(s => [s.key, { label: s.label, color: SOURCE_COLORS[s.key] ?? "#888" }])
  );
  return (
    <div className="flex items-center gap-3">
      <ChartContainer config={pieConfig} className="h-[130px] aspect-auto shrink-0" style={{ width: 130 }}>
        <PieChart>
          <Pie
            data={sources}
            cx="50%"
            cy="50%"
            innerRadius={36}
            outerRadius={54}
            dataKey="sec"
            nameKey="label"
            paddingAngle={2}
          >
            {sources.map((s, i) => (
              <Cell key={i} fill={SOURCE_COLORS[s.key] ?? "#888"} />
            ))}
          </Pie>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <p className="font-medium mb-0.5">{d.label}</p>
                  <p className="font-mono text-foreground">{fmtDurationShort(d.sec)}</p>
                  <p className="text-muted-foreground mt-0.5">{Math.round((d.sec / monthTotalSec) * 100)}%</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ChartContainer>

      {/* Legend as plain HTML — no foreignObject */}
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {sources.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: SOURCE_COLORS[s.key] ?? "#888" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
              <p className="text-[11px] font-mono text-foreground">{fmtDurationShort(s.sec)}</p>
            </div>
            <span className="text-[9.5px] font-mono text-muted-foreground shrink-0">
              {Math.round((s.sec / monthTotalSec) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export function MonthlyPanel({ data, isLoading }: { data: HistoryFetcherData; isLoading: boolean }) {
  const entries: TimeEntryRow[] = data.entries ?? [];
  const monthTotalSec = data.monthTotalSec ?? 0;
  const dailyTotals: DailyTotal[] = data.dailyTotals ?? [];
  const total = data.total ?? 0;

  const todayStr = new Date().toLocaleDateString("en-CA");
  const activeDays = dailyTotals.filter(d => d.count > 0).length;
  const totalDays = dailyTotals.length;
  const avgPerActiveDaySec = activeDays > 0 ? Math.floor(monthTotalSec / activeDays) : 0;
  const { longest, current } = computeStreaks(dailyTotals, todayStr);

  const bestDay = dailyTotals.reduce(
    (b, d) => d.totalSec > (b?.totalSec ?? 0) ? d : b,
    null as DailyTotal | null,
  );

  const topTasks = Object.entries(groupBy(entries, e => e.todoTitle))
    .map(([name, es]) => ({ name, totalSec: es.reduce((s, e) => s + e.durationSec, 0), count: es.length }))
    .sort((a, b) => b.totalSec - a.totalSec).slice(0, 8);

  const topProjects = Object.entries(groupBy(entries, e => e.projectName))
    .map(([name, es]) => ({ name, totalSec: es.reduce((s, e) => s + e.durationSec, 0), count: es.length }))
    .sort((a, b) => b.totalSec - a.totalSec).slice(0, 6);

  const sources = [
    { key: "BASECAMP",        label: "Basecamp" },
    { key: "GOOGLE_CALENDAR", label: "Google Calendar" },
    { key: "GOOGLE_TASKS",    label: "Google Tasks" },
  ].map(s => ({
    ...s,
    sec: entries.filter(e => e.source === s.key).reduce((sum, e) => sum + e.durationSec, 0),
  })).filter(s => s.sec > 0);

  if (entries.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <TrendingUp className="size-8 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No data this month</p>
        <p className="text-xs text-muted-foreground/60">Start tracking tasks to see your monthly review.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 transition-opacity duration-150", isLoading && "opacity-40")}>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total tracked" value={fmtDurationShort(monthTotalSec)} sub={`${total} entries`} />
        <StatCard label="Avg / active day" value={activeDays > 0 ? fmtDurationShort(avgPerActiveDaySec) : "—"} sub={`${activeDays} days worked`} />
        <StatCard
          label="Best day"
          value={bestDay?.totalSec ? fmtDurationShort(bestDay.totalSec) : "—"}
          sub={bestDay?.date ? new Date(bestDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : undefined}
        />
        <StatCard label="Streak" value={current > 0 ? `${current}d` : "—"} sub={longest > 0 ? `Best: ${longest}d` : undefined} accent={current >= 3} />
      </div>

      {/* Daily activity */}
      <Section
        title="Daily Activity"
        right={<ConsistencyRing activeDays={activeDays} totalDays={totalDays} />}
      >
        <DailyChart dailyTotals={dailyTotals} todayStr={todayStr} />
      </Section>

      {/* Week + Weekday side by side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section title="Week Breakdown">
          <WeekChart dailyTotals={dailyTotals} />
        </Section>
        <Section title="By Day of Week">
          <WeekdayChart entries={entries} />
        </Section>
      </div>

      {/* Hour distribution */}
      <Section title="Activity by Hour" right={<span className="text-[9px] text-muted-foreground">hover for details</span>}>
        <HourChart entries={entries} />
      </Section>

      {/* Top tasks */}
      {topTasks.length > 0 && (
        <Section title="Most Worked Tasks" right={<span className="text-[9px] font-mono text-muted-foreground">{topTasks.length} unique</span>}>
          <TasksChart tasks={topTasks} monthTotalSec={monthTotalSec} />
        </Section>
      )}

      {/* Projects + Source */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {topProjects.length > 0 && (
          <Section title="By Project">
            <ProjectsChart projects={topProjects} monthTotalSec={monthTotalSec} />
          </Section>
        )}
        {sources.length > 0 && (
          <Section title="By Source">
            <SourceDonut sources={sources} monthTotalSec={monthTotalSec} />
          </Section>
        )}
      </div>

      {/* Streak callout */}
      {longest >= 3 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Flame className="size-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              {current >= longest && current >= 3 ? `${current}-day streak — keep it going!` : `Best streak this month: ${longest} days`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeDays} active days · {Math.round((activeDays / totalDays) * 100)}% consistency
            </p>
          </div>
          <Target className="size-4 text-primary/50 shrink-0" />
        </div>
      )}

    </div>
  );
}
