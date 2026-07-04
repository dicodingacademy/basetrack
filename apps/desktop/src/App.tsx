import { useState, useEffect, useRef } from "react";
import { GripVertical, Play, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import "./App.css";

const API_KEY_STORAGE_KEY = "basetrack_desktop_api_key";
const WS_URL = "ws://localhost:8081";

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_STORAGE_KEY) || "");
  const [isEditingKey, setIsEditingKey] = useState(!apiKey);
  
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enforce Window Constraints & Boundaries
  useEffect(() => {
    const win = getCurrentWindow();
    win.setSize(new LogicalSize(350, 40));
    
    // Prevent window from getting lost under OS top bar (navbar)
    const boundsInterval = setInterval(async () => {
      try {
        const pos = await win.outerPosition();
        if (pos.y < 35) {
          await win.setPosition(new PhysicalPosition(pos.x, 35));
        }
      } catch (e) {
        // ignore errors
      }
    }, 1000);

    return () => clearInterval(boundsInterval);
  }, []);

  // Connection logic
  useEffect(() => {
    if (!apiKey || isEditingKey) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const connectWs = () => {
      setWsStatus("connecting");
      setErrorMessage("");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "AUTH", apiKey }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "AUTH_SUCCESS") {
            setWsStatus("connected");
          } else if (msg.type === "ERROR") {
            setWsStatus("error");
            setErrorMessage(msg.message);
            console.error("WS Error:", msg.message);
          } else if (msg.type === "TIMER_STARTED") {
            setActiveTimer(msg.timer);
          } else if (msg.type === "TIMER_STOPPED" || msg.type === "TIMER_AUTO_STOPPED") {
            setActiveTimer(null);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = (event) => {
        setWsStatus("disconnected");
        if (event.code !== 1000) {
          setErrorMessage((prev) => {
            if (event.reason) return event.reason;
            if (prev && prev !== "Network error or connection dropped") return prev;
            return `Closed with code ${event.code}`;
          });
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = (e) => {
        setWsStatus("error");
        setErrorMessage((prev) => prev || "Network error or connection dropped");
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close(1000);
      }
    };
  }, [apiKey, isEditingKey]);

  // Timer Tick
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => {
      const start = new Date(activeTimer.startedAt).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);
    
    // Initial run
    const start = new Date(activeTimer.startedAt).getTime();
    const now = Date.now();
    setElapsed(Math.floor((now - start) / 1000));

    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    setIsEditingKey(false);
  };

  const formatTime = () => {
    if (!activeTimer) return "00:00:00";
    const start = new Date(activeTimer.startedAt).getTime();
    const now = Date.now();
    const totalSeconds = Math.floor((now - start) / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  const handleToggleTimer = () => {
    if (activeTimer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "STOP_TIMER", apiKey }));
    }
  };

  if (isEditingKey) {
    return (
      <main className="h-10 w-screen flex flex-col bg-[#1C1C1E] text-white overflow-hidden border border-[#3C3C3E] select-none rounded-lg">
        <div 
          data-tauri-drag-region
          className="h-full w-full flex items-center justify-between px-2 cursor-move"
        >
          <form onSubmit={handleSaveKey} className="w-full flex items-center gap-2 pointer-events-none">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key (Double click status to edit later)"
              className="flex-1 bg-[#2C2C2E] border border-[#3C3C3E] rounded px-2 py-1 text-[11px] outline-none focus:border-blue-500 transition-colors cursor-text pointer-events-auto"
              autoFocus
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer pointer-events-auto">
              Save
            </button>
            <button type="button" onClick={closeWindow} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white cursor-pointer pointer-events-auto">
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Toolbar Mode
  return (
    <main className="h-10 w-screen flex items-center bg-[#1C1C1E] text-white overflow-hidden border border-[#3C3C3E] select-none rounded-lg shadow-xl">
      {/* Drag Handle */}
      <div 
        data-tauri-drag-region
        className="flex items-center h-full cursor-move px-1.5 hover:bg-white/5 transition-colors group"
      >
        <GripVertical className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 pointer-events-none" />
      </div>

      <div className="flex-1 flex items-center pr-1 pl-0.5 min-w-0">
        {/* Play/Stop Button */}
        <button 
          onClick={handleToggleTimer}
          title={activeTimer ? "Stop Timer" : "Start a timer from the Web App"}
          className={`flex-shrink-0 p-1 rounded transition-colors mr-1.5 ${!activeTimer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10'}`}
        >
          {activeTimer ? (
            <Square className="w-3.5 h-3.5 text-zinc-300 fill-zinc-300" />
          ) : (
            <Play className="w-3.5 h-3.5 text-zinc-300 fill-zinc-300" />
          )}
        </button>

        {/* Status Indicator & Title */}
        <div 
          className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer group min-w-0" 
          onDoubleClick={() => setIsEditingKey(true)} 
          title={errorMessage || wsStatus}
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            wsStatus === 'connected' 
              ? (activeTimer ? 'bg-green-500 animate-pulse' : 'bg-green-500') 
              : wsStatus === 'connecting' 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
          }`} />
          <span className="text-xs font-semibold truncate text-zinc-200 group-hover:text-white transition-colors">
            {activeTimer ? activeTimer.todoTitle : "Ready"}
          </span>
        </div>

        {/* Timer */}
        <div className="flex-shrink-0 text-xs font-mono font-medium text-zinc-100 tabular-nums px-2">
          {formatTime()}
        </div>

        {/* Close Button */}
        <button onClick={closeWindow} className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors cursor-pointer ml-0.5 text-zinc-400 hover:text-red-400" title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </main>
  );
}

export default App;
