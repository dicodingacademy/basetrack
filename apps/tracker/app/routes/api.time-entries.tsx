import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { prisma } from "../utils/db.server";

const PAGE_SIZE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return data({ entries: [], total: 0, page: 1, pageSize: PAGE_SIZE }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const status = url.searchParams.get("status") ?? "all";
  const source = url.searchParams.get("source") ?? "all";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, any> = { userId: user.id };

  if (status !== "all") {
    const statusMap: Record<string, string> = {
      synced: "SYNCED",
      failed: "FAILED",
      needs_approval: "NEEDS_APPROVAL",
      pending: "PENDING",
    };
    where.syncStatus = statusMap[status] ?? status.toUpperCase();
  }

  if (source !== "all") {
    const srcMap: Record<string, string> = {
      basecamp: "BASECAMP",
      calendar: "GOOGLE_CALENDAR",
      tasks: "GOOGLE_TASKS",
    };
    where.source = srcMap[source] ?? source.toUpperCase();
  }

  const startedAtFilter: Record<string, Date> = {};
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
  if (Object.keys(startedAtFilter).length > 0) where.startedAt = startedAtFilter;

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        todoTitle: true,
        projectName: true,
        startedAt: true,
        stoppedAt: true,
        durationSec: true,
        syncStatus: true,
        syncError: true,
        source: true,
      },
    }),
    prisma.timeEntry.count({ where }),
  ]);

  return data({ entries, total, page, pageSize: PAGE_SIZE });
}
