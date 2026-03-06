import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { Project } from "@/hooks/useProjects";

interface ProjectOverlayProps {
  project: Project | null;
  onClose: () => void;
}

const ProjectOverlay = ({ project, onClose }: ProjectOverlayProps) => {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (project) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [project, onClose]);

  if (!project) return null;

  const folders = (project.folders || []) as { name: string; count: number }[];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ animation: "fade-in 0.3s cubic-bezier(0.32,0.72,0,1)" }}
    >
      <div
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-[78vw] h-[78vh] bg-background overflow-hidden flex flex-col"
        style={{
          borderRadius: "12px",
          animation: "scale-in 0.35s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-full hover:bg-background transition-colors"
        >
          <X size={16} />
        </button>

        <div className="relative flex-1 min-h-0">
          {project.image_url ? (
            <img
              src={project.image_url}
              alt={project.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <span className="font-mono text-[48px] text-muted-foreground/20 font-bold">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <div className="p-6 space-y-4">
          {folders.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {folders.map((f) => (
                <span
                  key={f.name}
                  className={`px-2 py-0.5 text-[11px] font-mono gallery-border ${
                    f.count > 0 ? "text-foreground" : "text-muted-foreground/40"
                  }`}
                >
                  {f.name}{f.count > 0 ? `·${f.count}` : ""}
                </span>
              ))}
            </div>
          )}

          <h2 className="text-[22px] font-medium tracking-tight">
            {project.name}
            {project.room && (
              <span className="text-muted-foreground"> · {project.room}</span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 gallery-border font-mono text-[11px]">
              <span className={`status-dot status-dot-${project.status}`} />
              {project.status}
            </span>
            <span className="px-2 py-0.5 gallery-border font-mono text-[11px] text-muted-foreground">
              {project.dimensions}
            </span>
            {project.budget && (
              <span className="px-2 py-0.5 gallery-border font-mono text-[11px] text-muted-foreground">
                {project.budget}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => { onClose(); navigate(`/project/${project.id}`); }}
              className="h-[34px] px-4 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
            >
              Open Project
            </button>
            <button className="h-[34px] px-4 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">
              View Deck
            </button>
            <button className="h-[34px] px-4 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">
              Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverlay;
