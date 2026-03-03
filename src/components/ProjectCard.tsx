import type { Project } from "@/data/projects";
import { Plus } from "lucide-react";

interface ProjectCardProps {
  project: Project;
  isHero?: boolean;
  cols: number;
  onClick: () => void;
}

const statusLabel: Record<string, string> = {
  active: "active",
  draft: "draft",
  complete: "complete",
};

const ProjectCard = ({ project, isHero, cols, onClick }: ProjectCardProps) => {
  const showMetaAlways = cols <= 2;
  const hideMetaAlways = cols >= 6;
  const aspectClass = cols <= 2 ? "aspect-[16/9]" : cols >= 6 ? "aspect-square" : "aspect-[4/3]";

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden ${
        isHero ? "col-span-2 row-span-2" : ""
      }`}
    >
      <div className={`relative w-full ${aspectClass} overflow-hidden`}>
        <img
          src={project.image}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />

        {/* Agent badge */}
        {project.agentTask && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm px-2 py-1">
            <span className="status-dot status-dot-agent animate-pulse-dot" />
            <span className="font-mono text-[10px] text-muted-foreground">
              {project.agentTask}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {!hideMetaAlways && (
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 ${
              showMetaAlways ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <div
              className={`absolute bottom-0 left-0 right-0 p-3.5 transition-transform duration-300 ${
                showMetaAlways
                  ? "translate-y-0"
                  : "translate-y-2 group-hover:translate-y-0"
              }`}
            >
              <h3 className="text-[13px] font-medium text-background mb-1">
                {project.name}
                {project.room && (
                  <span className="text-background/60"> · {project.room}</span>
                )}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`status-dot status-dot-${project.status}`} />
                <span className="font-mono text-[10px] text-background/70">
                  {statusLabel[project.status]}
                </span>
                <span className="font-mono text-[10px] text-background/50">
                  {project.dimensions}
                </span>
                {project.budget && (
                  <span className="font-mono text-[10px] text-background/50">
                    {project.budget}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const NewProjectCard = ({ cols }: { cols: number }) => {
  const aspectClass = cols <= 2 ? "aspect-[16/9]" : cols >= 6 ? "aspect-square" : "aspect-[4/3]";

  return (
    <div className={`relative w-full ${aspectClass} gallery-border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-foreground/20 transition-colors`}>
      <Plus size={20} className="text-muted-foreground" />
      <span className="font-mono text-[11px] text-muted-foreground">New Project</span>
    </div>
  );
};

export default ProjectCard;
