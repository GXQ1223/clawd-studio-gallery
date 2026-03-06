import { useState, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { riversideAssets, riversideFeed } from "@/data/workspace-data";
import type { Asset } from "@/data/workspace-data";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";
import OnboardingOverlay from "@/components/workspace/OnboardingOverlay";
import CustomizeModal, { type CustomizeResult } from "@/components/CustomizeModal";
import WorkspaceTransition from "@/components/WorkspaceTransition";
import { useDesignerAgent } from "@/hooks/useDesignerAgent";
import { toast } from "sonner";
import type { Attachment } from "@/components/workspace/AgentInputBar";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const updateProject = useUpdateProject();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingResult, setPendingResult] = useState<CustomizeResult | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const [keptAssets, setKeptAssets] = useState<Asset[]>([]);
  const [deletedRenderIds, setDeletedRenderIds] = useState<Set<string>>(new Set());
  const { runOrchestration, isAnalyzing, results, feedEntries } = useDesignerAgent(id || "");

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
    }
    setPendingResult(null);
    toast("✦ Display customized — you can adjust anytime");
  }, [pendingResult, id, navigate]);

  const handleAgentSubmit = useCallback(
    (text: string, _attachments: Attachment[]) => {
      if (!text.trim() && _attachments.length === 0) return;
      const brief = text || "Modern living room design with renders and furniture sourcing";
      runOrchestration(brief);
    },
    [runOrchestration]
  );

  // Add agent type to project folders
  const handleAddAgent = useCallback((type: string) => {
    if (!project || !id) return;
    const currentFolders = (project.folders || []) as { name: string; count: number }[];
    if (currentFolders.some((f) => f.name === type)) return;
    const newFolders = [...currentFolders, { name: type, count: 0 }];
    updateProject.mutate({ id, folders: newFolders as any });
    toast(`✦ ${type} agent added`);
  }, [project, id, updateProject]);

  // Image actions from feed
  const handleKeepImage = useCallback((render: { id: string; url: string; label: string }) => {
    const newAsset: Asset = {
      id: render.id,
      name: render.label,
      category: "perspective",
      date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      aiGenerated: true,
      imageUrl: render.url,
    };
    setKeptAssets((prev) => [...prev, newAsset]);
    toast("✦ Image added to gallery");
  }, []);

  const handleDeleteImage = useCallback((renderId: string) => {
    setDeletedRenderIds((prev) => new Set(prev).add(renderId));
    setKeptAssets((prev) => prev.filter((a) => a.id !== renderId));
    toast("Image removed");
  }, []);

  const handleRefineImage = useCallback((render: { id: string; url: string; label: string }) => {
    // Pre-fill a refinement prompt
    const brief = `Refine this render: "${render.label}" — make adjustments based on client feedback`;
    runOrchestration(brief);
  }, [runOrchestration]);

  const handleAssetDelete = useCallback((assetId: string) => {
    setKeptAssets((prev) => prev.filter((a) => a.id !== assetId));
    toast("Asset removed");
  }, []);

  const handleAssetRefine = useCallback((asset: Asset) => {
    const brief = `Refine this ${asset.category}: "${asset.name}"`;
    runOrchestration(brief);
  }, [runOrchestration]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <span className="font-mono text-[12px] text-muted-foreground animate-pulse">loading…</span>
      </div>
    );
  }

  if (!project) return <Navigate to="/" replace />;

  const projectFolders = (project.folders || []) as { name: string; count: number }[];

  const briefProject = {
    id: project.id,
    name: project.name,
    room: project.room || undefined,
    status: project.status as "active" | "draft" | "complete",
    dimensions: project.dimensions,
    budget: project.budget || undefined,
    image: project.image_url || "",
    agentTask: project.agent_task || undefined,
    folders: projectFolders,
  };

  const combinedFeed = [...riversideFeed.filter((f) => !f.inProgress), ...feedEntries];

  // Filter out deleted renders
  const filteredResults = results
    ? {
        ...results,
        renders: results.renders.filter((r) => !deletedRenderIds.has(r.id)),
      }
    : null;

  const dynamicAssets = filteredResults
    ? filteredResults.renders.map((r) => ({
        id: r.id,
        name: r.label,
        category: "perspective" as const,
        date: new Date(r.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        aiGenerated: true,
        imageUrl: r.url,
      }))
    : [];

  const allAssets = [...keptAssets, ...dynamicAssets, ...riversideAssets];
  const availableCategories = projectFolders.map((f) => f.name);

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
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
            <span className={`status-dot ${isAnalyzing ? "status-dot-agent animate-pulse-dot" : "status-dot-active"}`} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {isAnalyzing ? "working…" : "agent"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ProjectBrief
          project={briefProject}
          activeFolder={activeFolder}
          onFolderClick={setActiveFolder}
          onAddAgent={handleAddAgent}
        />
        <AssetGallery
          assets={allAssets}
          activeFolder={activeFolder}
          availableCategories={availableCategories}
          onAssetDelete={handleAssetDelete}
          onAssetRefine={handleAssetRefine}
          onFilesUploaded={(urls) => toast(`${urls.length} file(s) ready for agent`)}
          projectId={id}
        />
        <AgentFeed
          feed={combinedFeed}
          onSubmit={handleAgentSubmit}
          isWorking={isAnalyzing}
          results={filteredResults}
          onKeepImage={handleKeepImage}
          onDeleteImage={handleDeleteImage}
          onRefineImage={handleRefineImage}
        />
      </div>

      {id && <OnboardingOverlay projectId={id} />}
      <CustomizeModal open={customizeOpen} onOpenChange={setCustomizeOpen} onGenerate={handleGenerate} />
      <WorkspaceTransition active={transitioning} onComplete={handleTransitionComplete} />
    </div>
  );
};

export default ProjectWorkspace;
