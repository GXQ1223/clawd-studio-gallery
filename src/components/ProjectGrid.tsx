import { useState, useEffect, useCallback, useRef } from "react";
import { projects, type Project, type ProjectStatus } from "@/data/projects";
import ProjectCard, { NewProjectCard } from "./ProjectCard";
import ProjectOverlay from "./ProjectOverlay";

interface ProjectGridProps {
  filter: "all" | "active" | "draft" | "complete";
  viewMode: "grid" | "list";
}

const ProjectGrid = ({ filter, viewMode }: ProjectGridProps) => {
  const [cols, setCols] = useState(4);
  const [indicator, setIndicator] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const indicatorTimeout = useRef<ReturnType<typeof setTimeout>>();

  const filtered = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

  const showIndicator = useCallback((newCols: number) => {
    setIndicator(`⊞ ${newCols} columns`);
    if (indicatorTimeout.current) clearTimeout(indicatorTimeout.current);
    indicatorTimeout.current = setTimeout(() => setIndicator(null), 900);
  }, []);

  // Ctrl+wheel zoom
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setCols((prev) => {
        const next = e.deltaY > 0
          ? Math.min(prev + 1, 8)
          : Math.max(prev - 1, 1);
        if (next !== prev) showIndicator(next);
        return next;
      });
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [showIndicator]);

  // Touch pinch
  useEffect(() => {
    let lastDist = 0;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist) {
        const delta = dist - lastDist;
        if (Math.abs(delta) > 30) {
          setCols((prev) => {
            const next = delta > 0 ? Math.max(prev - 1, 1) : Math.min(prev + 1, 8);
            if (next !== prev) showIndicator(next);
            return next;
          });
          lastDist = dist;
        }
      } else {
        lastDist = dist;
      }
    };
    const onTouchEnd = () => { lastDist = 0; };
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [showIndicator]);

  return (
    <>
      <div
        className="pt-[96px] pb-[44px] px-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "var(--gallery-gap, 2px)",
        }}
      >
        {filtered.map((project, i) => (
          <ProjectCard
            key={project.id}
            project={project}
            isHero={i === 0 && cols >= 3}
            cols={cols}
            onClick={() => setSelectedProject(project)}
          />
        ))}
        <NewProjectCard cols={cols} />
      </div>

      {/* Column indicator */}
      {indicator && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] px-4 py-2 bg-foreground/90 text-background font-mono text-[13px] rounded-full animate-fade-indicator pointer-events-none">
          {indicator}
        </div>
      )}

      <ProjectOverlay
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </>
  );
};

export default ProjectGrid;
