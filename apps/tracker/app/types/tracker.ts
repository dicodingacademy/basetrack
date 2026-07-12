export type TimeEntryRow = {
  id: string;
  todoTitle: string;
  projectName: string;
  startedAt: string;
  stoppedAt: string;
  durationSec: number;
  syncStatus: string;
  syncError: string | null;
  source: string;
};

export type ActiveTimer = {
  todoId: string;
  todoTitle: string;
  projectName: string;
  startedAt: Date | string;
};

export type DailyTotal = { date: string; totalSec: number; count: number };

export type TimelineEntry = { startedAt: string; stoppedAt: string; source: string };

export type HistoryFetcherData = {
  mode: string;
  entries: TimeEntryRow[];
  total: number;
  date?: string;
  timeline?: TimelineEntry[];
  totalSec?: number;
  weekStart?: string;
  weekEnd?: string;
  dailyTotals?: DailyTotal[];
  weekTotalSec?: number;
  monthStart?: string;
  monthEnd?: string;
  monthParam?: string;
  monthTotalSec?: number;
};

export type TodayFetcherData = {
  mode: string;
  totalSec: number;
  total: number;
};
