import { useState, useEffect } from "react";
import { useFetcher, Form } from "react-router";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RuleList } from "./RuleList";
import { Settings, Loader2, CheckCircle2, XCircle, LogOut } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "~/lib/utils";
import type { AutoStopRuleData } from "./types";

type SettingsModalProps = {
  rules: AutoStopRuleData[];
  userTimezone: string;
  apiKey?: string | null;
  connectedProviders: string[];
  availableProviders: { id: string; label: string; scopes: string }[];
};

const THEMES = [
  { id: "light",    label: "Cream",    dot: "#f4813f", bg: "#faf7f4" },
  { id: "dark",     label: "Dark",     dot: "#f4813f", bg: "#1e2228" },
  { id: "ocean",    label: "Ocean",    dot: "#38bdf8", bg: "#0f1923" },
  { id: "forest",   label: "Forest",   dot: "#4ade80", bg: "#0f1a12" },
  { id: "lavender", label: "Lavender", dot: "#818cf8", bg: "#f4f0fb" },
] as const;

export function SettingsModal({ rules: initialRules, userTimezone, apiKey, connectedProviders, availableProviders }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const { theme, setTheme } = useTheme();
  const [localRules, setLocalRules] = useState<AutoStopRuleData[]>(initialRules);
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (open) {
      setLocalRules([...initialRules]);
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== userTimezone) {
        fetcher.submit({ intent: "UPDATE_TIMEZONE", timezone: detected }, { method: "post" });
      }
    }
  }, [open]);

  const handleSave = () => {
    const payload = localRules.map((r) => ({
      name: r.name || "",
      enabled: r.enabled,
      conditions: r.conditions,
    }));
    fetcher.submit(
      {
        intent: "SAVE_ALL_RULES",
        rules: JSON.stringify(payload),
      },
      { method: "post" }
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tracker Settings</DialogTitle>
          <DialogDescription>
            Configure auto-stop rules and integrations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <RuleList rules={localRules} onChange={setLocalRules} />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">API Integration</h4>
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="apiKey">Personal API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    readOnly
                    value={apiKey || "No key generated yet"}
                    className="font-mono text-xs bg-zinc-50 dark:bg-zinc-900"
                  />
                  {apiKey && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(apiKey);
                        alert("API Key copied to clipboard!");
                      }}
                    >
                      Copy
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={fetcher.state !== "idle"}
                  onClick={() => {
                    fetcher.submit({ intent: "GENERATE_API_KEY" }, { method: "post" });
                  }}
                >
                  {fetcher.state !== "idle" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    apiKey ? "Regenerate Key" : "Generate Key"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Appearance</h4>
            <div className="flex flex-wrap gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer",
                    theme === t.id
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <span
                    className="size-3 rounded-full flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.dot} 50%)` }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {availableProviders.map(p => {
            const isConnected = connectedProviders.includes(p.id);
            return (
              <div key={p.id} className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">{p.label} Integration</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm text-zinc-500">Not connected</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.scopes}
                  </p>
                  <div className="flex justify-start">
                    {isConnected ? (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="DISCONNECT" />
                        <input type="hidden" name="provider" value={p.id} />
                        <Button type="submit" variant="outline" size="sm" disabled={fetcher.state !== "idle"}>
                          {fetcher.state !== "idle" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            `Disconnect ${p.label}`
                          )}
                        </Button>
                      </fetcher.Form>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => { window.location.href = `/auth/${p.id}`; }}
                      >
                        Connect {p.label}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="flex-row items-center">
          <Form method="post" action="/auth/logout" className="mr-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </Form>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
