import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import type { ActiveTimerType } from "../types/basecamp";

export function useLiveTimer(apiKey?: string | null, wsUrl?: string, serverActiveTimer?: ActiveTimerType | null) {
  const revalidator = useRevalidator();
  const revalidateRef = useRef(revalidator.revalidate);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [localTimer, setLocalTimer] = useState<ActiveTimerType | null | undefined>(undefined);
  const activeTimer = localTimer !== undefined ? localTimer : (serverActiveTimer ?? null);

  useEffect(() => {
    revalidateRef.current = revalidator.revalidate;
  }, [revalidator.revalidate]);

  useEffect(() => {
    if (!apiKey) return;

    let mounted = true;

    const connect = () => {
      const ws = new WebSocket(wsUrl || "ws://localhost:8081");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "AUTH", apiKey }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "TIMER_STARTED") {
            setLocalTimer({
              ...message.timer,
              startedAt: new Date(message.timer.startedAt),
              lastPingAt: new Date(message.timer.lastPingAt),
            });
            if (!message.isInitialSync) revalidateRef.current();
          } else if (message.type === "TIMER_STOPPED" || message.type === "TIMER_AUTO_STOPPED") {
            setLocalTimer(null);
            if (!message.isInitialSync) revalidateRef.current();
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        if (mounted) reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [apiKey, wsUrl]);

  return { activeTimer };
}
