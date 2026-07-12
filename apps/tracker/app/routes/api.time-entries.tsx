import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { prisma } from "../utils/db.server";

const PAGE_SIZE = 20;

/** Returns UTC timestamps for local midnight and end-of-day in the given timezone. */
function getLocalDayBounds(dateStr: string, timezone: string) {
  // Use noon UTC as a stable reference to determine the timezone offset on that day
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
      hour12: false,
    }).formatToParts(noon)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, parseInt(p.value)])
  );
  // Local hour when it is noon UTC → offset = localHour - 12
  const offsetMs = (parts.hour * 60 + parts.minute) * 60_000 - 12 * 3_600_000;
  const dayStart = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000 - 1);
  return { dayStart, dayEnd };
}

function getWeekBounds(dateStr: string, timezone: string) {
  const { dayStart } = getLocalDayBounds(dateStr, timezone);
  const localDay = new Date(dayStart.getTime() + 12 * 3_600_000); // noon of local day
  const dow = localDay.getUTCDay(); // day-of-week in UTC (same as local day since we're at noon)
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(dayStart.getTime() + diffToMon * 24 * 3_600_000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3_600_000 - 1);
  return { weekStart, weekEnd };
}


export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ entries: [], total: 0, page: 1, pageSize: PAGE_SIZE }, { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "daily") {
    const tz = user.timezone ?? "UTC";
    const dateStr = url.searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const { dayStart, dayEnd } = getLocalDayBounds(dateStr, tz);

    const statusParam = url.searchParams.get("status") ?? "all";
    const sourceParam = url.searchParams.get("source") ?? "all";

    const statusMap: Record<string, "SYNCED" | "FAILED" | "NEEDS_APPROVAL" | "PENDING"> = {
      synced: "SYNCED", failed: "FAILED", needs_approval: "NEEDS_APPROVAL", pending: "PENDING",
    };
    const srcMap: Record<string, "BASECAMP" | "GOOGLE_CALENDAR" | "GOOGLE_TASKS"> = {
      basecamp: "BASECAMP", calendar: "GOOGLE_CALENDAR", tasks: "GOOGLE_TASKS",
    };

    const [entries, timeline] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          userId: user.id,
          startedAt: { gte: dayStart, lte: dayEnd },
          ...(statusParam !== "all" && statusMap[statusParam] && { syncStatus: statusMap[statusParam] }),
          ...(sourceParam !== "all" && srcMap[sourceParam] && { source: srcMap[sourceParam] }),
        },
        orderBy: { startedAt: "desc" },
        select: {
          id: true, todoTitle: true, projectName: true,
          startedAt: true, stoppedAt: true, durationSec: true,
          syncStatus: true, syncError: true, source: true,
        },
      }),
      prisma.timeEntry.findMany({
        where: { userId: user.id, startedAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true, stoppedAt: true, source: true, durationSec: true },
      }),
    ]);

    const totalSec = timeline.reduce((sum, e) => sum + e.durationSec, 0);

    return data({ mode: "daily", entries, total: entries.length, date: dateStr, timeline, totalSec });
  }

  if (mode === "weekly") {
    const tz = user.timezone ?? "UTC";
    const dateStr = url.searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const { weekStart, weekEnd } = getWeekBounds(dateStr, tz);

    const entries = await prisma.timeEntry.findMany({
      where: { userId: user.id, startedAt: { gte: weekStart, lte: weekEnd } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true, todoTitle: true, projectName: true,
        startedAt: true, stoppedAt: true, durationSec: true,
        syncStatus: true, syncError: true, source: true,
      },
    });

    const dailyMap: Record<string, { totalSec: number; count: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 24 * 3_600_000 + 12 * 3_600_000);
      dailyMap[d.toLocaleDateString("en-CA", { timeZone: tz })] = { totalSec: 0, count: 0 };
    }
    for (const e of entries) {
      const key = e.startedAt.toLocaleDateString("en-CA", { timeZone: tz });
      if (dailyMap[key]) {
        dailyMap[key].totalSec += e.durationSec;
        dailyMap[key].count++;
      }
    }

    const dailyTotals = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));
    const weekTotalSec = entries.reduce((sum, e) => sum + e.durationSec, 0);

    return data({
      mode: "weekly",
      entries,
      total: entries.length,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      dailyTotals,
      weekTotalSec,
    });
  }

  if (mode === "monthly") {
    const tz = user.timezone ?? "UTC";
    const monthParam = url.searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: tz }).slice(0, 7);
    const [year, month] = monthParam.split("-").map(Number);

    const firstDayStr = `${monthParam}-01`;
    const { dayStart: monthStart } = getLocalDayBounds(firstDayStr, tz);

    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = `${monthParam}-${String(lastDay).padStart(2, "0")}`;
    const { dayEnd: monthEnd } = getLocalDayBounds(lastDayStr, tz);

    const entries = await prisma.timeEntry.findMany({
      where: { userId: user.id, startedAt: { gte: monthStart, lte: monthEnd } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true, todoTitle: true, projectName: true,
        startedAt: true, stoppedAt: true, durationSec: true,
        syncStatus: true, syncError: true, source: true,
      },
    });

    const dailyMap: Record<string, { totalSec: number; count: number }> = {};
    for (let d = 1; d <= lastDay; d++) {
      dailyMap[`${monthParam}-${String(d).padStart(2, "0")}`] = { totalSec: 0, count: 0 };
    }
    for (const e of entries) {
      const key = new Date(e.startedAt).toLocaleDateString("en-CA", { timeZone: tz });
      if (dailyMap[key]) {
        dailyMap[key].totalSec += e.durationSec;
        dailyMap[key].count++;
      }
    }
    const dailyTotals = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const monthTotalSec = entries.reduce((sum, e) => sum + e.durationSec, 0);

    return data({
      mode: "monthly",
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      monthParam,
      entries,
      total: entries.length,
      monthTotalSec,
      dailyTotals,
    });
  }

  // Legacy: page/status/source/from/to
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const status = url.searchParams.get("status") ?? "all";
  const source = url.searchParams.get("source") ?? "all";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const legacyStatusMap: Record<string, "SYNCED" | "FAILED" | "NEEDS_APPROVAL" | "PENDING"> = {
    synced: "SYNCED", failed: "FAILED", needs_approval: "NEEDS_APPROVAL", pending: "PENDING",
  };
  const legacySrcMap: Record<string, "BASECAMP" | "GOOGLE_CALENDAR" | "GOOGLE_TASKS"> = {
    basecamp: "BASECAMP", calendar: "GOOGLE_CALENDAR", tasks: "GOOGLE_TASKS",
  };
  const startedAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) startedAtFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    startedAtFilter.lte = toDate;
  } else if (!from) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    startedAtFilter.gte = thirtyDaysAgo;
  }

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        userId: user.id,
        ...(status !== "all" && legacyStatusMap[status] && { syncStatus: legacyStatusMap[status] }),
        ...(source !== "all" && legacySrcMap[source] && { source: legacySrcMap[source] }),
        ...(Object.keys(startedAtFilter).length > 0 && { startedAt: startedAtFilter }),
      },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, todoTitle: true, projectName: true,
        startedAt: true, stoppedAt: true, durationSec: true,
        syncStatus: true, syncError: true, source: true,
      },
    }),
    prisma.timeEntry.count({
      where: {
        userId: user.id,
        ...(status !== "all" && legacyStatusMap[status] && { syncStatus: legacyStatusMap[status] }),
        ...(source !== "all" && legacySrcMap[source] && { source: legacySrcMap[source] }),
        ...(Object.keys(startedAtFilter).length > 0 && { startedAt: startedAtFilter }),
      },
    }),
  ]);

  return data({ entries, total, page, pageSize: PAGE_SIZE });
}
