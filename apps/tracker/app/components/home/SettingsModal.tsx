import { useState, useEffect } from "react";
import { Form, useFetcher } from "react-router";
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
import { Settings, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { AutoStopRuleData } from "./types";

type SettingsModalProps = {
  rules: AutoStopRuleData[];
  userTimezone: string;
  apiKey?: string | null;
  googleConnected?: boolean;
};

export function SettingsModal({ rules, userTimezone, apiKey, googleConnected }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();

  useEffect(() => {
    if (open) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== userTimezone) {
        fetcher.submit(
          { intent: "UPDATE_TIMEZONE", timezone: detected },
          { method: "post" }
        );
      }
    }
  }, [open]);

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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tracker Settings</DialogTitle>
          <DialogDescription>
            Configure auto-stop rules and integrations. Changes save automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <RuleList rules={rules} />
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
            <h4 className="text-sm font-medium mb-3">Google Integration</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {googleConnected ? (
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
                Connect your Google account to track time on Calendar events and Tasks.
              </p>
              <div className="flex justify-start">
                {googleConnected ? (
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="DISCONNECT_GOOGLE" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={fetcher.state !== "idle"}
                    >
                      {fetcher.state !== "idle" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        "Disconnect Google"
                      )}
                    </Button>
                  </fetcher.Form>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/auth/google";
                    }}
                  >
                    Connect Google Account
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
