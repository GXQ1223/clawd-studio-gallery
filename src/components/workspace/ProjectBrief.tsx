import AgentTypePicker from "./AgentTypePicker";

// Phase detection based on existing deliverables
function detectPhase(folders: { name: string; count: number }[]): { label: string; step: number; total: number } {
  const hasRenders = folders.some(f => f.name === "perspective" && f.count > 0);
  const hasPlan = folders.some(f => f.name === "plan" && f.count > 0);
  const hasDocumentation = folders.some(f => ["elevation", "section"].includes(f.name) && f.count > 0);

  if (hasDocumentation && hasPlan && hasRenders) return { label: "Documentation", step: 4, total: 5 };
  if (hasPlan && hasRenders) return { label: "Development", step: 3, total: 5 };
  if (hasRenders) return { label: "Concepts", step: 2, total: 5 };
  if (folders.length > 0) return { label: "Brief", step: 1, total: 5 };
  return { label: "Getting started", step: 0, total: 5 };
}

interface Props {
  project: {
    id: string;
    name: string;
    room?: string;
    status: "active" | "draft" | "complete";
    dimensions: string;
    budget?: string;
    image: string;
    agentTask?: string;
    folders: { name: string; count: number }[];
  };
  activeFolder: string | null;
  onFolderClick: (folder: string | null) => void;
  onAddAgent?: (type: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ProjectBrief = ({ project, activeFolder, onFolderClick, onAddAgent, collapsed, onToggleCollapse }: Props) => {
  const folders = project.folders || [];
  const phase = detectPhase(folders);

  if (collapsed) {
    return (
      <aside
        className="w-[48px] shrink-0 h-full flex flex-col items-center py-4 gap-3 cursor-pointer hover:bg-secondary/50 transition-colors"
        style={{ borderRight: "1px solid hsl(var(--border))" }}
        onClick={onToggleCollapse}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <path d="m9 18 6-6-6-6"/>
        </svg>
        <span className="font-mono text-[9px] text-muted-foreground" style={{ writingMode: "vertical-rl" }}>
          {project.name}
        </span>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] shrink-0 h-full overflow-y-auto px-4 py-4 flex flex-col gap-4"
      style={{ borderRight: "1px solid hsl(var(--border))" }}>
      {/* Header with collapse */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 min-w-0">
          <h1 className="text-[15px] font-medium tracking-tight truncate">{project.name}</h1>
          {project.room && (
            <span className="inline-block px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground gallery-border">
              {project.room}
            </span>
          )}
        </div>
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1">
        {project.dimensions && (
          <div className="font-mono text-[11px] text-muted-foreground">{project.dimensions}</div>
        )}
        {project.budget && (
          <div className="font-mono text-[11px] text-muted-foreground">{project.budget}</div>
        )}
      </div>

      {/* Phase indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Phase</span>
          <span className="font-mono text-[10px] text-foreground">{phase.label}</span>
        </div>
        <div className="flex gap-[2px]">
          {Array.from({ length: phase.total }).map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 transition-all"
              style={{
                backgroundColor: i < phase.step
                  ? "hsl(var(--foreground))"
                  : "hsl(var(--border))",
              }}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Outputs (deliverables) */}
      <div className="space-y-0.5">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Outputs</span>
        <button
          onClick={() => onFolderClick(null)}
          className={`w-full flex items-center justify-between py-1.5 px-1 text-[12px] font-mono transition-colors rounded-sm ${
            activeFolder === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>all</span>
        </button>
        {folders.map((f) => (
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
                  border: f.count > 0 ? "none" : "1px solid hsl(var(--muted-foreground) / 0.3)",
                }}
              />
              {f.name}
            </span>
            {f.count > 0 && (
              <span className="text-muted-foreground">({f.count})</span>
            )}
          </button>
        ))}

        {onAddAgent && (
          <AgentTypePicker
            existingTypes={folders.map((f) => f.name)}
            onAdd={onAddAgent}
          />
        )}
      </div>

      {/* Brief link */}
      <div className="mt-auto pt-4">
        <button className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          project.md
        </button>
      </div>
    </aside>
  );
};

export default ProjectBrief;
