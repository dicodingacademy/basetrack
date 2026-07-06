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
import { Briefcase } from "lucide-react";

type Project = {
  id: string;
  name: string;
};

type ProjectPickerModalProps = {
  projects: Project[];
  onSelect: (project: Project) => void;
  children: React.ReactElement;
};

export function ProjectPickerModal({ projects, onSelect, children }: ProjectPickerModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                onClick={() => {
                  onSelect(project);
                  setOpen(false);
                }}
              >
                <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm font-medium truncate">{project.name}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
