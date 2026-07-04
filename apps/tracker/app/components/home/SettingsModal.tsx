import { useState } from "react";
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
import { Settings, Loader2 } from "lucide-react";

type SettingsModalProps = {
  defaultAutoStopHours: number;
  desktopApiKey?: string | null;
};

export function SettingsModal({ defaultAutoStopHours, desktopApiKey }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tracker Settings</DialogTitle>
          <DialogDescription>
            Configure how the timer behaves. Changes are saved automatically when you submit.
          </DialogDescription>
        </DialogHeader>
        <Form method="post" id="settings-form" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="intent" value="UPDATE_SETTINGS" />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="autoStopThresholdHours" className="text-right col-span-2">
                Auto-Stop Threshold (Hours)
              </Label>
              <Input
                id="autoStopThresholdHours"
                name="autoStopThresholdHours"
                type="number"
                min="1"
                max="24"
                defaultValue={defaultAutoStopHours}
                className="col-span-2"
              />
            </div>
            <p className="text-xs text-muted-foreground ml-2 mb-4">
              Timers running longer than this limit will automatically stop and require your approval to be synced.
            </p>
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Desktop App Integration</h4>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="apiKey">Desktop API Key</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="apiKey" 
                      readOnly 
                      value={desktopApiKey || "No key generated yet"} 
                      className="font-mono text-xs bg-zinc-50 dark:bg-zinc-900"
                    />
                    {desktopApiKey && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(desktopApiKey);
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
                      desktopApiKey ? "Regenerate Key" : "Generate Key"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" form="settings-form">Save changes</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
