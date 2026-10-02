export const WIDGET_CSS = `
:host { all: initial; }
.bt {
  --bt-bg: #ffffff;
  --bt-fg: #1f1d1a;
  --bt-muted: #6b6560;
  --bt-border: #e7e1da;
  --bt-hover: #f5f0eb;
  --bt-active: #fdeee5;
  --bt-badge: #f1ece6;
  --bt-primary: #f4813f;
  --bt-primary-hover: #e8722f;
  --bt-primary-fg: #ffffff;
  --bt-danger: #d93f32;
  --bt-shadow: 0 12px 32px rgba(31, 29, 26, 0.18), 0 2px 6px rgba(31, 29, 26, 0.08);
  display: inline-flex;
  font: 500 13px/18px "Google Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--bt-fg);
  -webkit-font-smoothing: antialiased;
}
.bt[data-theme="dark"] {
  --bt-bg: #2a2d33;
  --bt-fg: #eceae7;
  --bt-muted: #a19c96;
  --bt-border: #3d4148;
  --bt-hover: #33373e;
  --bt-active: #3e342e;
  --bt-badge: #383c43;
  --bt-danger: #f2766b;
  --bt-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
}
.bt *, .bt *::before, .bt *::after { box-sizing: border-box; font: inherit; color: inherit; margin: 0; }
[hidden] { display: none !important; }
svg { width: 14px; height: 14px; flex: none; display: block; }

/* ── trigger ─────────────────────────────────────────────── */
.bar { display: inline-flex; height: 32px; }
button { appearance: none; border: 0; background: none; padding: 0; cursor: pointer; }
.main, .caret {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  background: var(--bt-primary);
  color: var(--bt-primary-fg);
  transition: background-color .12s ease;
}
.main { padding: 0 14px 0 11px; border-radius: 16px; max-width: 220px; }
.main .label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.main .ic:empty { display: none; }
.bar.split .main { border-radius: 16px 0 0 16px; padding-right: 10px; }
.caret { padding: 0 9px 0 7px; border-radius: 0 16px 16px 0; border-left: 1px solid rgba(255, 255, 255, 0.3); }
.main:hover, .caret:hover { background: var(--bt-primary-hover); }
.main.stop { background: transparent; color: var(--bt-danger); box-shadow: inset 0 0 0 1.5px currentColor; font-variant-numeric: tabular-nums; }
.main.stop:hover { background: var(--bt-hover); }
.main.neutral { background: transparent; color: var(--bt-fg); box-shadow: inset 0 0 0 1px var(--bt-border); padding: 0 14px; }
.main.neutral:hover { background: var(--bt-hover); }
.bt.floating .bar { border-radius: 16px; box-shadow: var(--bt-shadow); }
.bt.floating .main.stop, .bt.floating .main.neutral { background: var(--bt-bg); }
button:disabled { opacity: .6; cursor: progress; }
button:focus-visible { outline: 2px solid var(--bt-primary); outline-offset: 2px; }

/* ── popovers (fixed; positioned in JS) ──────────────────── */
.panel, .toast {
  position: fixed;
  z-index: 2147483647;
  background: var(--bt-bg);
  border: 1px solid var(--bt-border);
  border-radius: 12px;
  box-shadow: var(--bt-shadow);
}
.toast { padding: 8px 12px; font-size: 12px; line-height: 16px; font-weight: 400; color: var(--bt-muted); }
.toast.error { color: var(--bt-danger); }

.panel { display: flex; flex-direction: column; padding: 6px; font-weight: 400; }
.panel-head { padding: 6px 8px 8px; }
.panel-title { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: .02em; color: var(--bt-muted); }
.panel-item { margin-top: 2px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  margin: 0 2px 4px;
  border-radius: 8px;
  background: var(--bt-hover);
  color: var(--bt-muted);
  cursor: text;
}
.search-wrap { transition: box-shadow .12s ease, background-color .12s ease; }
.search-wrap:focus-within { background: var(--bt-bg); box-shadow: inset 0 0 0 1px var(--bt-primary), 0 0 0 3px rgba(244, 129, 63, 0.18); color: var(--bt-fg); }
.search { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; box-shadow: none; background: transparent; color: var(--bt-fg); }
.search:focus, .search:focus-visible { outline: none; }
.search::placeholder { color: var(--bt-muted); }

.note { margin: 0 4px 4px; padding: 6px 8px; border-radius: 8px; background: var(--bt-active); font-size: 12px; line-height: 16px; }

.list { display: flex; flex-direction: column; max-height: 272px; overflow-y: auto; overscroll-behavior: contain; padding: 2px; scrollbar-width: thin; }
.item {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  text-align: left;
}
.item.active { background: var(--bt-active); }
.badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--bt-badge);
  color: var(--bt-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .02em;
}
.item.active .badge { background: var(--bt-primary); color: var(--bt-primary-fg); }
.name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.check { color: var(--bt-primary); }
.empty { flex: none; padding: 10px 8px; color: var(--bt-muted); font-size: 12px; }
.err { margin: 4px 4px 0; padding: 6px 8px; border-radius: 8px; color: var(--bt-danger); font-size: 12px; line-height: 16px; background: var(--bt-hover); }

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 8px 6px 2px 8px;
  border-top: 1px solid var(--bt-border);
}
.remember { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--bt-muted); cursor: pointer; }
.remember span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.remember input { flex: none; width: 14px; height: 14px; accent-color: var(--bt-primary); cursor: pointer; }
.icon-btn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: var(--bt-muted); }
.icon-btn:hover { background: var(--bt-hover); color: var(--bt-fg); }
`;
