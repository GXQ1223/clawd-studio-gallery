import { useState, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import type { Asset } from "@/data/workspace-data";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";
import OnboardingOverlay from "@/components/workspace/OnboardingOverlay";
import EmptyBriefPrompt from "@/components/workspace/EmptyBriefPrompt";
import { useDesignerAgent } from "@/hooks/useDesignerAgent";
import { toast } from "sonner";
import type { Attachment } from "@/components/workspace/AgentInputBar";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const updateProject = useUpdateProject();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [keptAssets, setKeptAssets] = useState<Asset[]>([]);
  const [deletedRenderIds, setDeletedRenderIds] = useState<Set<string>>(new Set());
  const { runOrchestration, completePlanning, isAnalyzing, results, feedEntries, acknowledgment, planningQuestions } = useDesignerAgent(id || "");

  // Submit from empty brief prompt or chat
  const handleBriefSubmit = useCallback((brief: string) => {
    setHasStarted(true);
    setChatOpen(true);
    runOrchestration(brief);
  }, [runOrchestration]);

  const handleAgentSubmit = useCallback(
    (text: string, _attachments: Attachment[]) => {
      if (!text.trim() && _attachments.length === 0) return;
      const brief = text || "Modern design with renders and furniture sourcing";
      runOrchestration(brief);
    },
    [runOrchestration]
  );

  const handleCompletePlanning = useCallback((answers: Record<string, string>) => {
    completePlanning(answers);
  }, [completePlanning]);

  // Add deliverable type
  const handleAddAgent = useCallback((type: string) => {
    if (!project || !id) return;
    const currentFolders = (project.folders || []) as { name: string; count: number }[];
    if (currentFolders.some((f) => f.name === type)) return;
    const newFolders = [...currentFolders, { name: type, count: 0 }];
    updateProject.mutate({ id, folders: newFolders as any });
    toast(`✦ ${type} output added`);
  }, [project, id, updateProject]);

  // Image actions
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
    setChatOpen(true);
    const brief = `Refine this render: "${render.label}" — make adjustments based on client feedback`;
    runOrchestration(brief);
  }, [runOrchestration]);

  const handleAssetDelete = useCallback((assetId: string) => {
    setKeptAssets((prev) => prev.filter((a) => a.id !== assetId));
    toast("Asset removed");
  }, []);

  const handleAssetRefine = useCallback((asset: Asset) => {
    setChatOpen(true);
    runOrchestration(`Refine this ${asset.category}: "${asset.name}"`);
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

  // Filter out deleted renders
  const filteredResults = results
    ? { ...results, renders: results.renders.filter((r) => !deletedRenderIds.has(r.id)) }
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

  const allAssets = [...keptAssets, ...dynamicAssets];
  const availableCategories = projectFolders.map((f) => f.name);

  // Determine if workspace has any content
  const hasContent = hasStarted || allAssets.length > 0 || projectFolders.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="h-[48px] shrink-0 bg-background flex items-center px-5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
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
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-1.5 h-[30px] px-3 font-mono text-[12px] transition-colors gallery-border ${
              chatOpen ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ✦ Assistant
          </button>
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">Share</button>
          <div className="flex items-center gap-2 ml-2">
            <span className={`status-dot ${isAnalyzing ? "status-dot-agent animate-pulse-dot" : "status-dot-active"}`} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {isAnalyzing ? "working…" : "ready"}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Brief sidebar — always visible but collapsible */}
        {hasContent && (
          <ProjectBrief
            project={briefProject}
            activeFolder={activeFolder}
            onFolderClick={setActiveFolder}
            onAddAgent={handleAddAgent}
            collapsed={briefCollapsed}
            onToggleCollapse={() => setBriefCollapsed(!briefCollapsed)}
          />
        )}

        {/* Center: Empty brief or Gallery */}
        {!hasContent ? (
          <EmptyBriefPrompt
            projectName={project.name}
            onSubmitBrief={handleBriefSubmit}
            onFilesUploaded={(urls) => toast(`${urls.length} file(s) ready`)}
            projectId={id}
            isWorking={isAnalyzing}
          />
        ) : (
          <AssetGallery
            assets={allAssets}
            activeFolder={activeFolder}
            availableCategories={availableCategories}
            onAssetDelete={handleAssetDelete}
            onAssetRefine={handleAssetRefine}
            onFilesUploaded={(urls) => toast(`${urls.length} file(s) ready`)}
            projectId={id}
          />
        )}

        {/* Chat drawer — slides in from right */}
        {chatOpen && (
          <AgentFeed
            feed={feedEntries}
            onSubmit={handleAgentSubmit}
            isWorking={isAnalyzing}
            results={filteredResults}
            onKeepImage={handleKeepImage}
            onDeleteImage={handleDeleteImage}
            onRefineImage={handleRefineImage}
            acknowledgment={acknowledgment}
            planningQuestions={planningQuestions}
            onCompletePlanning={handleCompletePlanning}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      {id && <OnboardingOverlay projectId={id} />}
    </div>
  );
};

export default ProjectWorkspace;
