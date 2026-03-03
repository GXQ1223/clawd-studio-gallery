import { useState } from "react";
import { useNavigate } from "react-router-dom";

const tabs = ["Projects", "Library", "Inspiration", "Sourcing", "Compare"];

const TopNav = () => {
  const [activeTab, setActiveTab] = useState("Projects");
  const navigate = useNavigate();

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Compare") navigate("/mvp");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[48px] bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
      {/* Left: wordmark */}
      <div className="font-mono text-[13px] font-medium tracking-tight select-none">
        clawd·studio
      </div>

      {/* Center: tabs */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`text-[13px] font-sans transition-colors ${
              activeTab === tab
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Right: agent status + new project */}
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-active animate-pulse-dot" />
          <span className="font-mono text-[11px] text-muted-foreground">
            agent · 2 tasks
          </span>
        </div>
        <button className="h-[30px] px-3 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity">
          New Project
        </button>
      </div>
    </header>
  );
};

export default TopNav;
