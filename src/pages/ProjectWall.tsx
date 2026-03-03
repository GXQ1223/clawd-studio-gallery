import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { projects } from "@/data/projects";
import { wallAssets, wallZones, type WallAsset } from "@/data/wall-data";
import { riversideFeed } from "@/data/workspace-data";
import { ArrowLeft } from "lucide-react";

/* ── SVG Visuals ── */

const PlanLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`v${i}`} x1={`${(i + 1) * 12.5}%`} y1="10%" x2={`${(i + 1) * 12.5}%`} y2="90%" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`h${i}`} x1="10%" y1={`${(i + 1) * 12.5}%`} x2="90%" y2={`${(i + 1) * 12.5}%`} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
    ))}
    <rect x="15%" y="15%" width="70%" height="55%" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
    <rect x="15%" y="15%" width="40%" height="30%" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
  </svg>
);

const SketchLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 12 }).map((_, i) => (
      <line key={i} x1={`${10 + i * 7}%`} y1={`${15 + Math.sin(i) * 10}%`} x2={`${15 + i * 7}%`} y2={`${75 + Math.cos(i) * 8}%`} stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeLinecap="round" />
    ))}
    <path d="M 20% 60% Q 40% 30% 60% 55% T 85% 40%" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.2" />
  </svg>
);

const renderGradients = [
  "linear-gradient(135deg, #c9c0b4 0%, #a89880 100%)",
  "linear-gradient(135deg, #d6cfc8 0%, #b0a89e 100%)",
  "linear-gradient(135deg, #c4bfcc 0%, #9e97ac 100%)",
];

const refGradients = [
  "linear-gradient(135deg, #b8c4c2 0%, #8fa8a4 100%)",
  "linear-gradient(135deg, #c2cac0 0%, #96a892 100%)",
  "linear-gradient(135deg, #c9c0b4 0%, #b0a89e 100%)",
];

/* ── Asset Card ── */

const AssetCard = ({
  asset,
  index,
  selected,
  onSelect,
}: {
  asset: WallAsset;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);

  const bg =
    asset.style === "render" ? renderGradients[index % 3] :
    asset.style === "plan" ? "#fafafa" :
    asset.style === "sketch" ? "#f5f3f0" :
    asset.style === "product" ? "#ffffff" :
    refGradients[index % 3];

  const border = asset.style === "plan" || asset.style === "sketch" || asset.style === "product"
    ? "1px solid rgba(0,0,0,0.1)" : "none";

  return (
    <div
      className="absolute cursor-grab active:cursor-grabbing select-none"
      style={{
        left: asset.x,
        top: asset.y,
        width: asset.width,
        transform: `rotate(${asset.rotation}deg)`,
        zIndex: selected ? 100 : hovered ? 50 : 1,
        transition: "box-shadow 0.2s ease",
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.1)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(asset.id);
      }}
    >
      {/* Visual */}
      <div
        className="relative overflow-hidden"
        style={{ height: asset.height, background: bg, border }}
      >
        {asset.style === "plan" && <PlanLines />}
        {asset.style === "sketch" && <SketchLines />}

        {/* Product content */}
        {asset.style === "product" && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" style={{ background: "linear-gradient(135deg, #e8e4e0 0%, #d1cbc4 100%)" }} />
            <div className="p-3 bg-background">
              <div className="text-[12px] font-medium">{asset.productName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[11px]">{asset.productPrice}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{asset.productBrand}</span>
              </div>
            </div>
          </div>
        )}

        {/* AI badge */}
        {asset.aiGenerated && (
          <div className="absolute top-2 right-2 text-[14px] opacity-50 select-none">★</div>
        )}
      </div>

      {/* Label */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground truncate">{asset.name}</span>
        <span className="font-mono text-[9px] text-muted-foreground/50 shrink-0">{asset.category}</span>
      </div>

      {/* Selected actions */}
      {selected && (
        <div className="absolute -bottom-8 left-0 flex items-center gap-1 animate-fade-in">
          <button className="px-2 py-0.5 font-mono text-[9px] text-muted-foreground gallery-border hover:text-foreground transition-colors bg-background">Remove</button>
          <button className="px-2 py-0.5 font-mono text-[9px] text-muted-foreground gallery-border hover:text-foreground transition-colors bg-background">Set as Hero</button>
          <button className="px-2 py-0.5 font-mono text-[9px] text-muted-foreground gallery-border hover:text-foreground transition-colors bg-background">Add to Deck</button>
        </div>
      )}
    </div>
  );
};

/* ── Mini Map ── */

const MiniMap = ({ panX, panY, zoom, canvasW, canvasH, viewW, viewH }: {
  panX: number; panY: number; zoom: number;
  canvasW: number; canvasH: number; viewW: number; viewH: number;
}) => {
  const mapW = 100;
  const mapH = 75;
  const sx = mapW / canvasW;
  const sy = mapH / canvasH;
  const vw = (viewW / zoom) * sx;
  const vh = (viewH / zoom) * sy;
  const vx = (-panX / zoom) * sx;
  const vy = (-panY / zoom) * sy;

  return (
    <div className="w-[100px] h-[75px] relative" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}>
      {wallAssets.map((a) => (
        <div key={a.id} className="absolute" style={{
          left: a.x * sx, top: a.y * sy,
          width: a.width * sx, height: a.height * sy,
          background: a.style === "render" ? "rgba(180,170,155,0.5)" :
            a.style === "product" ? "rgba(200,200,200,0.5)" : "rgba(0,0,0,0.08)",
        }} />
      ))}
      <div className="absolute border border-foreground/30" style={{
        left: Math.max(0, vx), top: Math.max(0, vy),
        width: Math.min(vw, mapW), height: Math.min(vh, mapH),
      }} />
    </div>
  );
};

/* ── Agent Panel ── */

const AgentPanel = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="fixed right-0 top-[48px] bottom-0 bg-background z-40 transition-all duration-300 flex flex-col"
      style={{
        width: expanded ? 280 : 24,
        borderLeft: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="h-[48px] flex items-center justify-center shrink-0 hover:bg-secondary/50 transition-colors"
      >
        {expanded ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
        ) : (
          <div className="flex flex-col gap-1.5 items-center">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="status-dot status-dot-agent" />
            <span className="status-dot status-dot-active" />
          </div>
        )}
      </button>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0 animate-fade-in">
          {riversideFeed.map((entry) => (
            <div key={entry.id} className="py-1.5 flex gap-2 items-start">
              <span className="font-mono text-[9px] text-muted-foreground shrink-0 mt-[2px] w-[32px]">{entry.time}</span>
              <span className="flex items-start gap-1 text-[11px] leading-relaxed">
                {entry.inProgress ? (
                  <span className="mt-[4px] shrink-0 status-dot status-dot-agent animate-pulse-dot" />
                ) : (
                  <span className="mt-[2px] shrink-0 text-[9px] opacity-40 select-none">★</span>
                )}
                <span className={entry.inProgress ? "text-muted-foreground" : "text-foreground"}>{entry.text}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Page ── */

const ProjectWall = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);

  const canvasW = 1600;
  const canvasH = 1200;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((z) => Math.min(2, Math.max(0.3, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setSelected(null);
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  if (!project) return <Navigate to="/" replace />;

  const viewW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewH = typeof window !== "undefined" ? window.innerHeight - 48 : 800;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Nav */}
      <header className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0 z-50 relative">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => navigate("/")} className="font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors">Projects</button>
          <span className="text-muted-foreground/30 text-[12px]">/</span>
          <span className="text-[13px] font-medium truncate max-w-[200px]">{project.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">View Deck</button>
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">Share</button>
          <div className="flex items-center gap-2 ml-2">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="font-mono text-[11px] text-muted-foreground">agent</span>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          background: "#fafafa",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: canvasW,
            height: canvasH,
            position: "absolute",
          }}
        >
          {/* Zone labels */}
          {wallZones.map((z) => (
            <div
              key={z.label}
              className="absolute font-mono text-[11px] text-muted-foreground/30 tracking-[0.15em] uppercase select-none"
              style={{ left: z.x, top: z.y }}
            >
              {z.label}
            </div>
          ))}

          {/* Assets */}
          {wallAssets.map((asset, i) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              index={i}
              selected={selected === asset.id}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* Fixed UI: zoom controls bottom-right */}
        <div className="absolute bottom-4 right-8 flex items-center gap-1 z-40">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="w-[28px] h-[28px] flex items-center justify-center gallery-border bg-background font-mono text-[13px] hover:bg-secondary transition-colors"
          >+</button>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="w-[28px] h-[28px] flex items-center justify-center gallery-border bg-background font-mono text-[13px] hover:bg-secondary transition-colors"
          >−</button>
          <button
            onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }}
            className="h-[28px] px-2 flex items-center justify-center gallery-border bg-background font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >fit</button>
          <span className="font-mono text-[10px] text-muted-foreground/40 ml-1">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Fixed UI: mini-map bottom-left */}
        <div className="absolute bottom-4 left-4 z-40">
          <MiniMap panX={pan.x} panY={pan.y} zoom={zoom} canvasW={canvasW} canvasH={canvasH} viewW={viewW} viewH={viewH} />
        </div>

        {/* Fixed UI: Add Asset top-right */}
        <div className="absolute top-4 right-8 z-40 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="font-mono text-[10px] text-muted-foreground">agent active</span>
          </div>
          <button className="h-[30px] px-3 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity">
            Add Asset
          </button>
        </div>
      </div>

      {/* Agent panel */}
      <AgentPanel />
    </div>
  );
};

export default ProjectWall;
