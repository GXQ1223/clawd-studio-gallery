import { useEffect, useRef, useState, useCallback } from "react";
import type { FeedEntry } from "@/data/workspace-data";
import type { OrchestrationResult } from "@/lib/designerAgent";
import AgentInputBar, { type Attachment } from "./AgentInputBar";
import PlanningQuestions, { type PlanningQuestion } from "./PlanningQuestions";
import RenderAnnotation, { type Annotation } from "./RenderAnnotation";
import FurnitureCompositor, { type PlacedFurniture } from "./FurnitureCompositor";

interface Props {
  feed: FeedEntry[];
  onSubmit?: (text: string, attachments: Attachment[]) => void;
  isWorking?: boolean;
  results?: OrchestrationResult | null;
  onKeepImage?: (render: { id: string; url: string; label: string }) => void;
  onDeleteImage?: (id: string) => void;
  onRefineImage?: (render: { id: string; url: string; label: string }) => void;
  onAnnotateImage?: (renderId: string, x: number, y: number, text: string) => void;
  acknowledgment?: string | null;
  planningQuestions?: PlanningQuestion[] | null;
  onCompletePlanning?: (answers: Record<string, string>) => void;
  isDrawer?: boolean;
  onClose?: () => void;
}

const AgentFeed = ({ feed, onSubmit, isWorking, results, onKeepImage, onDeleteImage, onRefineImage, onAnnotateImage, acknowledgment, planningQuestions, onCompletePlanning, isDrawer, onClose }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [annotatingRender, setAnnotatingRender] = useState<{ id: string; url: string; label: string } | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({});
  const [compositingRender, setCompositingRender] = useState<{ id: string; url: string; label: string } | null>(null);
  const [furniturePlacements, setFurniturePlacements] = useState<Record<string, PlacedFurniture[]>>({});

  const handleAddAnnotation = useCallback((x: number, y: number, text: string) => {
    if (!annotatingRender) return;
    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x,
      y,
      text,
      createdAt: new Date().toISOString(),
    };
    setAnnotations((prev) => ({
      ...prev,
      [annotatingRender.id]: [...(prev[annotatingRender.id] || []), annotation],
    }));
    onAnnotateImage?.(annotatingRender.id, x, y, text);
  }, [annotatingRender, onAnnotateImage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feed, results, acknowledgment, planningQuestions]);

  const handleSubmit = (text: string, attachments: Attachment[]) => {
    if (!text.trim() && attachments.length === 0) return;
    onSubmit?.(text, attachments);
    setInput("");
  };

  const suggestions = ["Remove yellow tones", "Generate floor plan", "Source furniture"];

  const isEmpty = feed.length === 0 && (!results || (results.renders.length === 0 && results.products.length === 0)) && !planningQuestions;

  return (
    <aside
      className={`${isDrawer ? "w-full" : "w-[360px]"} shrink-0 h-full flex flex-col bg-background`}
      style={{ borderLeft: "1px solid hsl(var(--border))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[40px] shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-2">
          {isWorking && <span className="status-dot status-dot-agent animate-pulse-dot" />}
          ✦ Assistant
        </span>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {isEmpty && !acknowledgment && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
            <span className="text-[32px] select-none">✦</span>
            <div className="space-y-2">
              <p className="text-[14px] font-medium">How can I help?</p>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
                Describe what you're looking for — renders, floor plans, furniture sourcing — and I'll get to work.
              </p>
            </div>
          </div>
        )}

        {/* Acknowledgment card */}
        {acknowledgment && !planningQuestions && (
          <div className="mb-3 p-3 bg-secondary/50 gallery-border">
            <p className="text-[12px] leading-relaxed">{acknowledgment}</p>
            {isWorking && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="status-dot status-dot-agent animate-pulse-dot" />
                <span className="font-mono text-[10px] text-muted-foreground">Working on it…</span>
              </div>
            )}
          </div>
        )}

        {/* Planning questions — interactive discovery */}
        {planningQuestions && acknowledgment && (
          <div className="mb-3 space-y-3">
            <div className="p-3 bg-secondary/50 gallery-border">
              <p className="text-[12px] leading-relaxed">{acknowledgment}</p>
            </div>
            <PlanningQuestions
              questions={planningQuestions}
              onComplete={(answers) => onCompletePlanning?.(answers)}
              isGenerating={isWorking}
            />
          </div>
        )}

        {feed.map((entry) => (
          <div key={entry.id} className="py-2 flex gap-2 items-start">
            <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-[2px] w-[36px]">
              {entry.time}
            </span>
            <span className="flex items-start gap-1.5 text-[12px] leading-relaxed">
              {entry.inProgress ? (
                <span className="mt-[5px] shrink-0 status-dot status-dot-agent animate-pulse-dot" />
              ) : (
                <span className="mt-[3px] shrink-0 text-[10px] opacity-40 select-none">★</span>
              )}
              <span className={entry.inProgress ? "text-muted-foreground" : "text-foreground"}>
                {entry.text}
              </span>
            </span>
          </div>
        ))}

        {/* Render results */}
        {results && results.renders.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Renders</p>
            <div className="grid grid-cols-2 gap-1.5">
              {results.renders.map((r) => (
                <div key={r.id} className="group relative">
                  <img
                    src={r.url}
                    alt={r.label}
                    className="w-full aspect-[4/3] object-cover"
                    style={{ border: "1px solid hsl(var(--border))" }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.label}</p>
                  <div className="absolute inset-0 flex items-end justify-center gap-1 pb-6 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/40 to-transparent">
                    {onKeepImage && (
                      <button onClick={() => onKeepImage(r)} className="px-2 py-1 bg-white/90 text-foreground text-[9px] font-mono hover:bg-white transition-colors">Keep</button>
                    )}
                    <button onClick={() => setAnnotatingRender(r)} className="px-2 py-1 bg-white/90 text-foreground text-[9px] font-mono hover:bg-white transition-colors">
                      Annotate{annotations[r.id]?.length ? ` (${annotations[r.id].length})` : ""}
                    </button>
                    {results && results.products.length > 0 && (
                      <button onClick={() => setCompositingRender(r)} className="px-2 py-1 bg-white/90 text-foreground text-[9px] font-mono hover:bg-white transition-colors">
                        Compose{furniturePlacements[r.id]?.length ? ` (${furniturePlacements[r.id].length})` : ""}
                      </button>
                    )}
                    {onRefineImage && (
                      <button onClick={() => onRefineImage(r)} className="px-2 py-1 bg-white/90 text-foreground text-[9px] font-mono hover:bg-white transition-colors">Refine</button>
                    )}
                    {onDeleteImage && (
                      <button onClick={() => onDeleteImage(r.id)} className="px-2 py-1 bg-white/90 text-destructive text-[9px] font-mono hover:bg-white transition-colors">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product results */}
        {results && results.products.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Shopping List</p>
            <div className="space-y-1.5">
              {results.products.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-secondary/50 transition-colors" style={{ border: "1px solid hsl(var(--border) / 0.5)" }}>
                  <img src={p.image} alt={p.name} className="w-[36px] h-[36px] object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.brand} · ${p.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {results.shoppingList && (
                <div className="pt-1 flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{results.shoppingList.item_count} items</span>
                  <span className="font-medium text-foreground">${results.shoppingList.total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input — hide during planning mode */}
      {!planningQuestions && (
        <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <AgentInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            suggestions={isWorking ? undefined : (isEmpty ? ["Generate renders", "Create floor plan", "Source furniture"] : suggestions)}
            compact
          />
        </div>
      )}

      {/* Annotation modal */}
      {annotatingRender && (
        <RenderAnnotation
          renderUrl={annotatingRender.url}
          renderLabel={annotatingRender.label}
          annotations={annotations[annotatingRender.id] || []}
          onAddAnnotation={handleAddAnnotation}
          onClose={() => setAnnotatingRender(null)}
        />
      )}

      {/* Furniture compositor modal */}
      {compositingRender && results && (
        <FurnitureCompositor
          renderUrl={compositingRender.url}
          renderLabel={compositingRender.label}
          products={results.products}
          placements={furniturePlacements[compositingRender.id] || []}
          onUpdatePlacements={(placements) => {
            setFurniturePlacements((prev) => ({
              ...prev,
              [compositingRender.id]: placements,
            }));
          }}
          onClose={() => setCompositingRender(null)}
        />
      )}
    </aside>
  );
};

export default AgentFeed;
