import { useState } from "react";
import { browser } from "wxt/browser";
import { BASETRACK_URL } from "../../lib/config";
import { elapsedSec, fmtClock } from "../../lib/format";
import { useExtensionState, useHostPermissions, useNow } from "../../lib/hooks";
import { send } from "../../lib/messages";
import "./popup.css";

export default function App() {
  const { loaded, user, activeTimer } = useExtensionState();
  const now = useNow(!!activeTimer);
  const perms = useHostPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    if (!res.ok) setError(res.message ?? "Something went wrong");
    setBusy(false);
  }

  const openBasetrack = () => void browser.tabs.create({ url: BASETRACK_URL });
  const openOptions = () => void browser.runtime.openOptionsPage();

  if (!loaded) return <main className="popup" />;

  return (
    <main className="popup stack">
      <header className="row">
        <span className="logo">BT</span>
        <h1>Basetrack</h1>
        <span className="spacer" />
        {user && <span className="muted small truncate" title={user.email}>{user.name}</span>}
      </header>

      {!perms.granted && (
        <div className="card stack">
          <p className="small">Basetrack needs access to Basetrack, Google Calendar, Google Docs and GitHub.</p>
          <button className="btn primary" onClick={() => void perms.request()}>Grant access</button>
        </div>
      )}

      {!user ? (
        <div className="card stack">
          <p className="small muted">Connect your Basetrack account to start timers from Calendar, Docs and GitHub Projects.</p>
          <button className="btn primary" disabled={busy} onClick={() => run(() => send({ type: "connect" }))}>
            {busy ? "Connecting…" : "Connect to Basetrack"}
          </button>
        </div>
      ) : activeTimer ? (
        <div className="card stack">
          <div className="row small muted">
            <span className="dot live" />
            <span className="truncate">{activeTimer.projectName}</span>
          </div>
          <p className="title">{activeTimer.todoTitle}</p>
          <div className="row">
            <span className="mono clock">{fmtClock(elapsedSec(activeTimer.startedAt, now))}</span>
            <span className="spacer" />
            <button className="btn danger" disabled={busy} onClick={() => run(() => send({ type: "stop" }))}>
              ■ Stop
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="small muted">No timer running. Open an event in Google Calendar, a Google Doc or a GitHub project item and press Start.</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <footer className="row small">
        <button className="btn link" onClick={openBasetrack}>Open Basetrack</button>
        <span className="spacer" />
        <button className="btn link" onClick={openOptions}>Options</button>
      </footer>
    </main>
  );
}
