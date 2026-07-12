import { useTheme } from "~/hooks/useTheme";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CheckCircle2, LogOut, Plus, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";

const THEMES = [
  { id: "light", label: "Cream", dot: "#f4813f", bg: "#faf7f4" },
  { id: "dark", label: "Dark", dot: "#f4813f", bg: "#1e2228" },
  { id: "ocean", label: "Ocean", dot: "#38bdf8", bg: "#0f1923" },
  { id: "forest", label: "Forest", dot: "#4ade80", bg: "#0f1a12" },
  { id: "lavender", label: "Lavender", dot: "#818cf8", bg: "#f4f0fb" },
] as const;

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="border-t pt-5">
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
  );
}

export function SettingsPreview() {
  return (
    <div className="rounded-xl border bg-card text-sm text-card-foreground shadow-xl">
      {/* dialog header */}
      <div className="border-b p-5">
        <h3 className="text-lg font-semibold">Tracker Settings</h3>
        <p className="text-xs text-muted-foreground">Configure auto-stop rules and integrations.</p>
      </div>

      <div className="space-y-6 p-5">
        {/* auto-stop rules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Auto-Stop Rules</h4>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
              <Plus className="mr-1 size-3" />
              Add Rule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A timer will auto-stop when <strong>any</strong> rule matches (all conditions within a rule must be met).
          </p>

          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="relative inline-flex h-5 w-9 items-center rounded-full bg-primary transition-colors"
                >
                  <span className="inline-block size-3.5 translate-x-4 rounded-full bg-primary-foreground transition-transform" />
                </button>
                <span className="text-sm font-medium">Daily limit</span>
              </div>
              <button type="button" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">elapsed hours</Badge>
              <span className="text-xs text-muted-foreground">is greater than or equal to</span>
              <span className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs">8</span>
            </div>
          </div>
        </div>

        {/* api integration */}
        <div className="border-t pt-5">
          <h4 className="text-sm font-medium mb-3">API Integration</h4>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="preview-api-key">Personal API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="preview-api-key"
                  readOnly
                  value="bt_live_••••••••••••••••"
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="sm">Copy</Button>
              </div>
            </div>
            <div className="flex justify-start">
              <Button type="button" variant="secondary" size="sm">Regenerate Key</Button>
            </div>
          </div>
        </div>

        {/* appearance */}
        <AppearanceSection />

        {/* google integration */}
        <div className="border-t pt-5">
          <h4 className="text-sm font-medium mb-3">Google Integration</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <span className="text-sm">Connected</span>
            </div>
            <p className="text-xs text-muted-foreground">
              calendar.readonly, tasks.readonly
            </p>
            <div className="flex justify-start">
              <Button type="button" variant="outline" size="sm">Disconnect Google</Button>
            </div>
          </div>
        </div>
      </div>

      {/* dialog footer */}
      <div className="flex flex-row items-center justify-end gap-2 border-t bg-muted/30 p-4">
        <Button type="button" variant="ghost" size="sm" className="mr-auto gap-1.5 text-muted-foreground">
          <LogOut className="size-3.5" />
          Sign out
        </Button>
        <Button type="button" variant="outline" size="sm">Cancel</Button>
        <Button type="button" size="sm">Save Changes</Button>
      </div>
    </div>
  );
}
