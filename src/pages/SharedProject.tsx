import { useParams } from "react-router-dom";
import { useSharedProject } from "@/hooks/useProjects";
import { DesignerAgent, type OrchestrationResult } from "@/lib/designerAgent";
import { useEffect, useState } from "react";

const SharedProject = () => {
  const { token } = useParams();
  const { data: project, isLoading, error } = useSharedProject(token);
  const [results, setResults] = useState<OrchestrationResult | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoadingResults(true);
    DesignerAgent.loadPersistedResults(project.id).then((r) => {
      setResults(r);
      setLoadingResults(false);
    });
  }, [project]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <span className="font-mono text-[12px] text-muted-foreground animate-pulse">loading shared project…</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-[32px] select-none">🔒</div>
          <h2 className="text-[16px] font-medium">Project not found</h2>
          <p className="font-mono text-[12px] text-muted-foreground">
            This share link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  const folders = (project.folders || []) as { name: string; count: number }[];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="h-[48px] shrink-0 bg-background flex items-center px-5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium">{project.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 bg-secondary">shared view</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {project.project_type} · {project.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
          {/* Project info */}
          <div className="space-y-2">
            <h1 className="text-[24px] font-medium">{project.name}</h1>
            <div className="flex items-center gap-4 font-mono text-[12px] text-muted-foreground">
              {project.room && <span>{project.room}</span>}
              {project.dimensions && <span>{project.dimensions}</span>}
              {project.budget && <span>Budget: {project.budget}</span>}
            </div>
            {folders.length > 0 && (
              <div className="flex gap-2 mt-2">
                {folders.map((f) => (
                  <span key={f.name} className="font-mono text-[10px] px-2 py-1 bg-secondary text-muted-foreground">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Renders */}
          {loadingResults ? (
            <div className="text-center py-12">
              <span className="font-mono text-[12px] text-muted-foreground animate-pulse">loading renders…</span>
            </div>
          ) : results && results.renders.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">Renders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.renders.map((r) => (
                  <div key={r.id} className="group">
                    <img src={r.url} alt={r.label} className="w-full aspect-[4/3] object-cover" style={{ border: "1px solid hsl(var(--border))" }} />
                    <p className="text-[12px] text-muted-foreground mt-1">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Products */}
          {results && results.products.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">Shopping List</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3" style={{ border: "1px solid hsl(var(--border))" }}>
                    {p.image && <img src={p.image} alt={p.name} className="w-[48px] h-[48px] object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.brand} · ${p.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {results.shoppingList && (
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                  <span>{results.shoppingList.item_count} items</span>
                  <span className="font-medium text-foreground">${results.shoppingList.total.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loadingResults && (!results || (results.renders.length === 0 && results.products.length === 0)) && (
            <div className="text-center py-16">
              <div className="text-[32px] select-none mb-3">✦</div>
              <p className="font-mono text-[12px] text-muted-foreground">No deliverables generated yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedProject;
