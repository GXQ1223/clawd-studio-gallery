import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import StudioView from "@/components/mvp/StudioView";
import JournalView from "@/components/mvp/JournalView";
import WallView from "@/components/mvp/WallView";
import DeckView from "@/components/mvp/DeckView";
import CustomizeModal, { type CustomizeResult } from "@/components/CustomizeModal";
import WorkspaceTransition from "@/components/WorkspaceTransition";
import { toast } from "sonner";

const tabs = ["Studio", "Journal", "Wall", "Deck"] as const;
type Tab = (typeof tabs)[number];

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
