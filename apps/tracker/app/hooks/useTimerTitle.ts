import { useEffect, useRef } from "react";
import type { ActiveTimerType } from "../types/basecamp";

export function useTimerTitle(activeTimer: ActiveTimerType | null) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const defaultTitle = "Basetrack - Basecamp Time Tracker";

    if (!activeTimer) {
      document.title = defaultTitle;
      return;
    }

    const updateTitle = () => {
      const elapsed = Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;

      const time = h > 0
        ? `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

      document.title = `${time} - Basetrack`;
    };

    updateTitle();
    intervalRef.current = setInterval(updateTitle, 1000);

    return () => {
      document.title = defaultTitle;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer?.id, activeTimer?.startedAt]);
}
