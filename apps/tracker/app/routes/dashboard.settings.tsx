import { useEffect, useState } from "react";
import { useFetcher, redirect } from "react-router";
import type { Route } from "./+types/dashboard.settings";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { getRules, replaceAllRules, updateUserTimezone } from "../services/rules.server";
import { RuleList } from "../components/home/RuleList";
import { Button } from "../components/ui/button";
import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/utils";
import { Loader2 } from "lucide-react";
import type { AutoStopRuleData, Condition } from "../components/home/types";

export function meta() {
  return [{ title: "Basetrack - Settings" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");

  const rules = await getRules(user.id);
  return {
    timezone: user.timezone,
    rules: rules.map(r => ({ id: r.id, enabled: r.enabled, name: r.name, conditions: r.conditions as unknown as Condition[] })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "SAVE_ALL_RULES") {
    const rulesStr = form.get("rules") as string;
    if (!rulesStr) return { ok: false };
    let parsed: unknown;
    try { parsed = JSON.parse(rulesStr); } catch { return { ok: false }; }
    if (!Array.isArray(parsed)) return { ok: false };
    await replaceAllRules(user.id, parsed.map(r => ({ name: r.name, enabled: r.enabled !== false, conditions: r.conditions })));
    return { ok: true };
  }

  if (intent === "UPDATE_TIMEZONE") {
    const timezone = form.get("timezone") as string;
    if (timezone) await updateUserTimezone(user.id, timezone);
    return { ok: true };
  }

  return { ok: false };
}

const THEMES = [
  { id: "light",    label: "Cream",    dot: "#f4813f", bg: "#faf7f4" },
  { id: "dark",     label: "Dark",     dot: "#f4813f", bg: "#1e2228" },
  { id: "ocean",    label: "Ocean",    dot: "#38bdf8", bg: "#0f1923" },
  { id: "forest",   label: "Forest",   dot: "#4ade80", bg: "#0f1a12" },
  { id: "lavender", label: "Lavender", dot: "#818cf8", bg: "#f4f0fb" },
] as const;

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { rules: initialRules, timezone } = loaderData;
  const fetcher = useFetcher();
  const saving = fetcher.state !== "idle";
  const { theme, setTheme } = useTheme();
  const [rules, setRules] = useState<AutoStopRuleData[]>(initialRules);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== timezone) {
      fetcher.submit({ intent: "UPDATE_TIMEZONE", timezone: detected }, { method: "post" });
    }
  }, []);

  const save = () => {
    fetcher.submit(
      { intent: "SAVE_ALL_RULES", rules: JSON.stringify(rules.map(r => ({ name: r.name || "", enabled: r.enabled, conditions: r.conditions }))) },
      { method: "post" },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold mb-0.5">Settings</p>
        <p className="text-xs text-muted-foreground">Auto-stop rules, timezone and appearance.</p>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <RuleList rules={rules} onChange={setRules} />
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-1">Timezone</h2>
        <p className="text-xs text-muted-foreground">
          Detected from your browser and used to place entries on the correct Basecamp day: <span className="font-mono">{timezone}</span>
        </p>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer",
                theme === t.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-muted-foreground",
              )}
            >
              <span className="size-3 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.dot} 50%)` }} />
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
