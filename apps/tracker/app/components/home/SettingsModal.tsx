import { useState } from "react";
import { Form } from "react-router";
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
import { Settings } from "lucide-react";

type SettingsModalProps = {
  defaultAutoStopHours: number;
};

export function SettingsModal({ defaultAutoStopHours }: SettingsModalProps) {
  const [open, setOpen] = useState(false);

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
        <Form method="post" onSubmit={() => setOpen(false)}>
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
            <p className="text-xs text-muted-foreground ml-2">
              Timers running longer than this limit will automatically stop and require your approval to be synced.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
