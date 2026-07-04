import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

export function useTimerWebSocket(desktopApiKey?: string | null, wsUrl?: string) {
  const revalidator = useRevalidator();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!desktopApiKey) return;

    let isComponentMounted = true;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl || "ws://localhost:8081");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "AUTH", apiKey: desktopApiKey }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (["TIMER_STOPPED", "TIMER_STARTED", "TIMER_AUTO_STOPPED"].includes(message.type)) {
            revalidator.revalidate();
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
  }, [desktopApiKey, wsUrl, revalidator]);
}
