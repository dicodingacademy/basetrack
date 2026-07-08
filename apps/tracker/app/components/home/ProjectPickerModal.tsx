import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Briefcase, Loader2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
};

type ProjectPickerModalProps = {
  projects: Project[];
  onSelect: (project: Project) => Promise<void> | void;
  children: React.ReactElement;
};

export function ProjectPickerModal({ projects, onSelect, children }: ProjectPickerModalProps) {
  const [open, setOpen] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (project: Project) => {
    setError(null);
    setCheckingId(project.id);
    try {
      await onSelect(project);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan, coba lagi.");
    } finally {
      setCheckingId(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Select Basecamp Project</DialogTitle>
          <DialogDescription>
            Choose a project to track this item under. Only timesheet-enabled projects are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4 max-h-[300px] overflow-y-auto">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No timesheet-enabled projects found.
            </p>
          ) : (
            projects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="justify-start gap-3 h-auto py-3 px-4"
                disabled={checkingId !== null}
                onClick={() => handleSelect(project)}
              >
                {checkingId === project.id ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{project.name}</span>
              </Button>
            ))
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive pb-2 px-1">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
