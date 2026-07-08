import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import type { ActiveTimerType } from "../types/basecamp";

export type StartTimerData = {
  todoId: string;
  todoTitle: string;
  projectId: string;
  projectName: string;
  source?: string;
};

export function useTimerWebSocket(
  apiKey?: string | null,
  wsUrl?: string,
  serverActiveTimer?: ActiveTimerType | null
) {
  const revalidator = useRevalidator();
  const revalidateRef = useRef(revalidator.revalidate);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // undefined = no WS event yet, fall back to serverActiveTimer
  // null = WS confirmed stopped
  // ActiveTimerType = WS confirmed started (or optimistic)
  const [localTimer, setLocalTimer] = useState<ActiveTimerType | null | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const activeTimer = localTimer !== undefined ? localTimer : (serverActiveTimer ?? null);

  useEffect(() => {
    revalidateRef.current = revalidator.revalidate;
  }, [revalidator.revalidate]);

  useEffect(() => {
    if (!apiKey) return;

    let isComponentMounted = true;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl || "ws://localhost:8081");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "AUTH", apiKey }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "TIMER_STARTED") {
            const timer: ActiveTimerType = {
              ...message.timer,
              startedAt: new Date(message.timer.startedAt),
              lastPingAt: new Date(message.timer.lastPingAt),
            };
            setLocalTimer(timer);
            setIsPending(false);
            if (!message.isInitialSync) {
              revalidateRef.current();
            }
          } else if (message.type === "TIMER_STOPPED" || message.type === "TIMER_AUTO_STOPPED") {
            setLocalTimer(null);
            setIsPending(false);
            if (!message.isInitialSync) {
              revalidateRef.current();
            }
          } else if (message.type === "TIMER_ERROR") {
            // Rollback optimistic state
            setLocalTimer(undefined);
            setIsPending(false);
            console.error("Timer command failed:", message.code, message.message);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        if (isComponentMounted) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [apiKey, wsUrl]);

  function startTimer(data: StartTimerData) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot start timer");
      return;
    }
    // Optimistic: show timer immediately before server confirms
    setLocalTimer({
      id: "optimistic",
      userId: "",
      todoId: data.todoId,
      todoTitle: data.todoTitle,
      projectId: data.projectId,
      projectName: data.projectName,
      startedAt: new Date(),
      lastPingAt: new Date(),
      source: data.source || "BASECAMP",
    });
    setIsPending(true);
    wsRef.current.send(JSON.stringify({ type: "START_TIMER", ...data }));
  }

  function stopTimer() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot stop timer");
      return;
    }
    // Optimistic: clear timer immediately before server confirms
    setLocalTimer(null);
    setIsPending(true);
    wsRef.current.send(JSON.stringify({ type: "STOP_TIMER" }));
  }

  return { activeTimer, startTimer, stopTimer, isPending };
}
