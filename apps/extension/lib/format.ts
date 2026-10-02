export function elapsedSec(startedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

/** 75 → "01:15", 3725 → "1:02:05" */
export function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** Short badge text: "12m", "3h". */
export function fmtBadge(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  if (m < 1) return "●";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
