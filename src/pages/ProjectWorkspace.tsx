import { useState, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { projects } from "@/data/projects";
import { riversideAssets, riversideFeed } from "@/data/workspace-data";
import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";
import CustomizeModal, { type CustomizeResult } from "@/components/CustomizeModal";
import WorkspaceTransition from "@/components/WorkspaceTransition";
import { useDesignerAgent } from "@/hooks/useDesignerAgent";
import { toast } from "sonner";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingResult, setPendingResult] = useState<CustomizeResult | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const { spawnAgent, isAnalyzing, sessions } = useDesignerAgent(id || "");

  const handleGenerate = useCallback((result: CustomizeResult) => {
    setPendingResult(result);
    setTransitioning(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setTransitioning(false);
    setIsCustomized(true);
    if (pendingResult && id) {
      if (pendingResult === "journal") navigate(`/workspace/journal/${id}`);
      else if (pendingResult === "wall") navigate(`/workspace/wall/${id}`);
      else if (pendingResult === "deck") navigate(`/workspace/deck/${id}`);
      // "studio" stays here
    }
    setPendingResult(null);
    toast("✦ Display customized — you can adjust anytime");
  }, [pendingResult, id, navigate]);

  if (!project) return <Navigate to="/" replace />;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
        {/* Re-use WorkspaceNav content inline to add customize button */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </button>
          <button onClick={() => navigate("/")} className="font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors">Projects</button>
          <span className="text-muted-foreground/30 text-[12px]">/</span>
          <span className="text-[13px] font-medium truncate max-w-[200px]">{project.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-1.5 h-[30px] px-3 font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors gallery-border"
          >
            {isCustomized && <span className="w-[5px] h-[5px] rounded-full bg-foreground" />}
            Customize ✦
          </button>
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">View Deck</button>
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">Share</button>
          <div className="flex items-center gap-2 ml-2">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="font-mono text-[11px] text-muted-foreground">agent</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ProjectBrief project={project} activeFolder={activeFolder} onFolderClick={setActiveFolder} />
        <AssetGallery assets={riversideAssets} activeFolder={activeFolder} />
        <AgentFeed feed={riversideFeed} />
      </div>

      <CustomizeModal open={customizeOpen} onOpenChange={setCustomizeOpen} onGenerate={handleGenerate} />
      <WorkspaceTransition active={transitioning} onComplete={handleTransitionComplete} />
    </div>
  );
};

export default ProjectWorkspace;
