import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { projects } from "@/data/projects";
import { riversideAssets, riversideFeed } from "@/data/workspace-data";
import { journalFeed } from "@/data/journal-data";
import { wallAssets, wallZones } from "@/data/wall-data";
import { deckSlides } from "@/data/deck-data";
import AgentInputBar from "@/components/workspace/AgentInputBar";

import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import ProjectBrief from "@/components/workspace/ProjectBrief";
import AssetGallery from "@/components/workspace/AssetGallery";
import AgentFeed from "@/components/workspace/AgentFeed";
import CustomizeModal, { type CustomizeResult } from "@/components/CustomizeModal";
import WorkspaceTransition from "@/components/WorkspaceTransition";
import { toast } from "sonner";

const tabs = ["Studio", "Journal", "Wall", "Deck"] as const;
type Tab = (typeof tabs)[number];

const project = projects[0];

/* ── Embedded Studio View ── */
const StudioView = () => {
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  return (
    <div className="h-full flex flex-col bg-background">
      <WorkspaceNav projectName={project.name} />
      <div className="flex flex-1 min-h-0">
        <ProjectBrief project={project} activeFolder={activeFolder} onFolderClick={setActiveFolder} />
        <AssetGallery assets={riversideAssets} activeFolder={activeFolder} />
        <AgentFeed feed={riversideFeed} />
      </div>
    </div>
  );
};

/* ── Embedded Journal View ── */
const JournalView = () => {
  const [input, setInput] = useState("");
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 pb-32 pt-6">
          {journalFeed.map((entry) => (
            <div key={entry.id} className="py-4">
              {entry.type === "system" && (
                <div className="flex justify-center">
                  <span className="font-mono text-[11px] text-muted-foreground/50">{entry.text}</span>
                </div>
              )}
              {entry.type === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[70%] px-5 py-4" style={{ background: "rgba(0,0,0,0.03)" }}>
                    <p className="text-[14px] leading-relaxed">{entry.text}</p>
                    <span className="font-mono text-[10px] text-muted-foreground/40 mt-2 block text-right">{entry.time}</span>
                  </div>
                </div>
              )}
              {entry.type === "agent" && (
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="mt-[2px] text-[10px] opacity-40 select-none">★</span>
                    <span className="text-[14px] leading-relaxed flex-1">{entry.text}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">{entry.time}</span>
                  </div>
                </div>
              )}
              {entry.type === "upload" && (
                <div className="flex items-center gap-3">
                  <div className="w-[56px] h-[56px] bg-secondary flex items-center justify-center shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground">file</span>
                  </div>
                  <div>
                    <span className="font-mono text-[12px]">{entry.fileName}</span>
                    <div className="font-mono text-[10px] text-muted-foreground/40 mt-1">{entry.time}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 bg-background" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="max-w-[800px] mx-auto px-6 py-3">
          <AgentInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={(text) => { setInput(""); }}
          />
        </div>
      </div>
    </div>
  );
};

/* ── Embedded Wall View ── */
const WallView = () => {
  const [pan] = useState({ x: 0, y: 0 });
  const [zoom] = useState(0.45);
  return (
    <div className="h-full relative overflow-hidden" style={{ background: "#fafafa" }}>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: 2400,
          height: 1600,
          position: "absolute",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {wallZones.map((zone) => (
          <div key={zone.label} className="absolute font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/40" style={{ left: zone.x, top: zone.y - 30 }}>
            {zone.label}
          </div>
        ))}
        {wallAssets.map((asset) => (
          <div
            key={asset.id}
            className="absolute cursor-pointer"
            style={{ left: asset.x, top: asset.y, width: asset.width, height: asset.height, transform: `rotate(${asset.rotation || 0}deg)` }}
          >
            <div className="w-full h-full" style={{ background: asset.style === "render" ? "linear-gradient(135deg, #c9c0b4, #a89880)" : asset.style === "plan" ? "#fafafa" : "#f5f3f0", border: "1px solid rgba(0,0,0,0.1)" }} />
            <span className="font-mono text-[10px] text-muted-foreground/60 mt-1 block">{asset.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Embedded Deck View ── */
const DeckView = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = deckSlides[currentSlide];
  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[800px]" style={{ aspectRatio: "16/9", background: "#fff", boxShadow: "0 2px 20px rgba(0,0,0,0.06)" }}>
          <div className="w-full h-full flex items-center justify-center p-8">
            <div className="text-center">
              <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">{slide.type}</div>
              <div className="text-[18px] font-medium">{slide.label}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">←</button>
          {deckSlides.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-foreground" : "bg-muted-foreground/30"}`} />
          ))}
          <button onClick={() => setCurrentSlide(Math.min(deckSlides.length - 1, currentSlide + 1))} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">→</button>
        </div>
      </div>
      <div className="w-[240px] shrink-0 gallery-border border-t-0 border-b-0 border-r-0 overflow-y-auto p-3 space-y-2">
        {deckSlides.map((s, i) => (
          <button key={s.id} onClick={() => setCurrentSlide(i)} className={`w-full text-left p-2 transition-colors ${i === currentSlide ? "bg-secondary" : "hover:bg-secondary/50"}`}>
            <div className="font-mono text-[10px] text-muted-foreground/50">{String(i + 1).padStart(2, "0")}</div>
            <div className="text-[12px] font-medium truncate">{s.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground/40">{s.type}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const tabMap: Record<CustomizeResult, Tab> = {
  studio: "Studio",
  journal: "Journal",
  wall: "Wall",
  deck: "Deck",
};

const MvpCompare = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Studio");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = useCallback((result: CustomizeResult) => {
    setPendingTab(tabMap[result]);
    setTransitioning(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setTransitioning(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setIsCustomized(true);
    toast("✦ Display customized — you can adjust anytime");
  }, [pendingTab]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="font-mono text-[13px] font-medium tracking-tight select-none">MVP Compare</span>
        </div>

        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-[13px] font-sans transition-colors ${
                activeTab === tab ? "text-foreground font-medium bg-secondary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}

          <div className="w-px h-4 bg-border mx-2" />

          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {isCustomized && <span className="w-[5px] h-[5px] rounded-full bg-foreground" />}
            Customize ✦
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="status-dot status-dot-active animate-pulse-dot" />
          <span className="font-mono text-[11px] text-muted-foreground">comparing views</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "Studio" && <StudioView />}
        {activeTab === "Journal" && <JournalView />}
        {activeTab === "Wall" && <WallView />}
        {activeTab === "Deck" && <DeckView />}
      </div>

      <CustomizeModal open={customizeOpen} onOpenChange={setCustomizeOpen} onGenerate={handleGenerate} />
      <WorkspaceTransition active={transitioning} onComplete={handleTransitionComplete} />
    </div>
  );
};

export default MvpCompare;
