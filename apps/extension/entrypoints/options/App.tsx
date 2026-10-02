import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { BASETRACK_URL } from "../../lib/config";
import { useExtensionState, useHostPermissions, useProjects } from "../../lib/hooks";
import { send } from "../../lib/messages";
import { getContexts, getMappings, KEYS, onStorageChange, setContexts, setMappings } from "../../lib/storage";
import { SOURCES, type Mappings, type Project, type Source, type TrackingContext } from "../../lib/types";
import "./options.css";

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.key, s.label])) as Record<Source, string>;

function useMappingData() {
  const [mappings, setLocal] = useState<Mappings>({ defaults: {}, contexts: {} });
  const [contexts, setLocalContexts] = useState<TrackingContext[]>([]);

  useEffect(() => {
    const load = async () => {
      const [m, c] = await Promise.all([getMappings(), getContexts()]);
      setLocal(m);
      setLocalContexts(Object.values(c).sort((a, b) => b.lastSeen - a.lastSeen));
    };
    void load();
    return onStorageChange([KEYS.mappings, KEYS.contexts], () => void load());
  }, []);

  return { mappings, contexts };
}

function ProjectSelect({
  value,
  projects,
  emptyLabel,
  onChange,
}: {
  value: Project | undefined;
  projects: Project[] | null;
  emptyLabel: string;
  onChange: (p: Project | null) => void;
}) {
  // Keep a mapped project selectable even if it's no longer in the list.
  const options = projects ?? [];
  const withCurrent = value && !options.some((p) => p.id === value.id) ? [value, ...options] : options;

  return (
    <select
      value={value?.id ?? ""}
      disabled={!projects}
      onChange={(e) => onChange(withCurrent.find((p) => p.id === e.target.value) ?? null)}
    >
      <option value="">{projects ? emptyLabel : "Loading projects…"}</option>
      {withCurrent.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export default function App() {
  const { loaded, user } = useExtensionState();
  const { projects, error: projectsError, reload } = useProjects(!!user);
  const { mappings, contexts } = useMappingData();
  const perms = useHostPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    const res = await send({ type: "connect" });
    if (!res.ok) setError(res.message);
    setBusy(false);
  }

  async function disconnect() {
    setBusy(true);
    await send({ type: "disconnect" });
    setBusy(false);
  }

  async function setDefault(source: Source, project: Project | null) {
    const next = await getMappings();
    if (project) next.defaults[source] = project;
    else delete next.defaults[source];
    await setMappings(next);
  }

  async function setContextProject(key: string, project: Project | null) {
    const next = await getMappings();
    if (project) next.contexts[key] = project;
    else delete next.contexts[key];
    await setMappings(next);
  }

  async function removeContext(key: string) {
    const [m, c] = await Promise.all([getMappings(), getContexts()]);
    delete m.contexts[key];
    delete c[key];
    await Promise.all([setMappings(m), setContexts(c)]);
  }

  if (!loaded) return null;

  return (
    <main className="options stack">
      <header className="row">
        <span className="logo">BT</span>
        <h1>Basetrack Extension</h1>
      </header>

      {!perms.granted && (
        <section className="card row">
          <p className="small">Site access hasn't been granted yet (Firefox asks separately).</p>
          <span className="spacer" />
          <button className="btn primary" onClick={() => void perms.request()}>Grant access</button>
        </section>
      )}

      <section className="card stack">
        <h2>Account</h2>
        {user ? (
          <div className="row">
            <div>
              <p><strong>{user.name}</strong></p>
              <p className="muted small">{user.email}</p>
            </div>
            <span className="spacer" />
            <button className="btn danger" disabled={busy} onClick={() => void disconnect()}>Disconnect</button>
          </div>
        ) : (
          <div className="row">
            <p className="muted small">Not connected.</p>
            <span className="spacer" />
            <button className="btn primary" disabled={busy} onClick={() => void connect()}>
              {busy ? "Connecting…" : "Connect to Basetrack"}
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card stack">
        <div className="row">
          <h2>Default project per source</h2>
          <span className="spacer" />
          {user && <button className="btn link small" onClick={() => void reload()}>Refresh projects</button>}
        </div>
        <p className="muted small">
          Used when a calendar, document or GitHub project has no mapping of its own. You can always pick a different
          project from the ▾ menu when starting.
        </p>
        {projectsError && <p className="error">{projectsError}</p>}
        {!user ? (
          <p className="muted small">Connect your account to load Basecamp projects.</p>
        ) : (
          <div className="grid">
            {SOURCES.map((s) => (
              <label key={s.key} className="grid-row">
                <span>{s.label}</span>
                <ProjectSelect
                  value={mappings.defaults[s.key]}
                  projects={projects}
                  emptyLabel="— ask every time —"
                  onChange={(p) => void setDefault(s.key, p)}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Mappings</h2>
        <p className="muted small">
          Calendars, documents and GitHub projects you have tracked from. They're added automatically the first time you
          start a timer there.
        </p>
        {contexts.length === 0 ? (
          <p className="muted small">Nothing yet — start a timer from Calendar, Docs or GitHub Projects.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Context</th>
                <th>Source</th>
                <th>Basecamp project</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {contexts.map((c) => (
                <tr key={c.key}>
                  <td>
                    <div className="ctx-label">{c.label}</div>
                    <code className="muted">{c.key}</code>
                  </td>
                  <td className="small">{SOURCE_LABEL[c.source] ?? c.source}</td>
                  <td>
                    <ProjectSelect
                      value={mappings.contexts[c.key]}
                      projects={user ? projects : null}
                      emptyLabel={
                        mappings.defaults[c.source] ? `— default (${mappings.defaults[c.source]!.name}) —` : "— ask every time —"
                      }
                      onChange={(p) => void setContextProject(c.key, p)}
                    />
                  </td>
                  <td>
                    <button className="btn link small" onClick={() => void removeContext(c.key)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card stack small">
        <h2>Connection details</h2>
        <p>
          Basetrack URL: <code>{BASETRACK_URL}</code>
        </p>
        <p>
          OAuth redirect URL (add to <code>EXTENSION_REDIRECT_URIS</code> on the server):{" "}
          <code>{browser.identity.getRedirectURL()}</code>
        </p>
        <p>
          Extension ID: <code>{browser.runtime.id}</code>
        </p>
      </section>
    </main>
  );
}
