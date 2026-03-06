import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateProject } from "@/hooks/useProjects";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewProjectModal = ({ open, onOpenChange }: Props) => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [budget, setBudget] = useState("");
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        room: room.trim() || undefined,
        dimensions: dimensions.trim() || "TBD",
        budget: budget.trim() || undefined,
      });
      toast.success("Project created");
      onOpenChange(false);
      setName(""); setRoom(""); setDimensions(""); setBudget("");
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full h-[38px] px-3 bg-transparent gallery-border text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Room (optional)"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="flex-1 h-[38px] px-3 bg-transparent gallery-border text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              className="flex-1 h-[38px] px-3 bg-transparent gallery-border text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Budget (optional, e.g. $28k)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full h-[38px] px-3 bg-transparent gallery-border text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-[34px] px-4 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
              className="h-[34px] px-4 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createProject.isPending ? "Creating…" : "Create Project"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
