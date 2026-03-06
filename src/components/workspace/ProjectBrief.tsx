import type { Project } from "@/data/projects";

interface Props {
  project: Project;
  activeFolder: string | null;
  onFolderClick: (folder: string | null) => void;
}

const ProjectBrief = ({ project, activeFolder, onFolderClick }: Props) => {
  const sourced = 12400;
  const total = 28000;
  const pct = Math.round((sourced / total) * 100);

  return (
    <aside className="w-[280px] shrink-0 h-full overflow-y-auto px-5 py-5 flex flex-col gap-5"
      style={{ borderRight: "2px solid rgba(0,0,0,0.08)" }}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-[16px] font-medium tracking-tight">{project.name}</h1>
        {project.room && (
          <span className="inline-block px-2 py-0.5 font-mono text-[11px] text-muted-foreground gallery-border">
            {project.room}
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <div className="font-mono text-[12px] text-muted-foreground">{project.dimensions}</div>
        {project.budget && (
          <div className="font-mono text-[12px] text-muted-foreground">{project.budget}</div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="status-dot status-dot-draft" />
          <span className="font-mono text-[11px]">Design Development</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Folders */}
      <div className="space-y-0.5">
        <button
          onClick={() => onFolderClick(null)}
          className={`w-full flex items-center justify-between py-1.5 px-1 text-[12px] font-mono transition-colors rounded-sm ${
            activeFolder === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>all</span>
        </button>
        {project.folders?.map((f) => (
          <button
            key={f.name}
            onClick={() => onFolderClick(f.name)}
            className={`w-full flex items-center justify-between py-1.5 px-1 text-[12px] font-mono transition-colors rounded-sm ${
              activeFolder === f.name ? "bg-secondary text-foreground" : f.count > 0 ? "text-foreground hover:bg-secondary/50" : "text-muted-foreground/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-[5px] h-[5px] rounded-full"
                style={{
                  backgroundColor: f.count > 0 ? "hsl(var(--foreground))" : "transparent",
                  border: f.count > 0 ? "none" : "1px solid rgba(0,0,0,0.15)",
                }}
              />
              {f.name}
            </span>
            {f.count > 0 && (
              <span className="text-muted-foreground">({f.count})</span>
            )}
          </button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Quotation */}
      <div className="space-y-2">
        <div className="text-[12px] font-mono text-muted-foreground">
          ${sourced.toLocaleString()} sourced of ${total.toLocaleString()}
        </div>
        <div className="w-full h-[3px] bg-secondary overflow-hidden">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Brief link */}
      <div className="mt-auto pt-4">
        <button className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          project.md
        </button>
      </div>
    </aside>
  );
};

export default ProjectBrief;
