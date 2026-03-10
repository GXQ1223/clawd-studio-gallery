import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import NewProjectModal from "@/components/NewProjectModal";

const tabs = ["Projects", "Library", "Inspiration", "Sourcing", "Compare"];

const TopNav = () => {
  const [activeTab, setActiveTab] = useState("Projects");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const tabRoutes: Record<string, string> = {
    Projects: "/",
    Library: "/library",
    Inspiration: "/inspiration",
    Sourcing: "/sourcing",
    Compare: "/mvp",
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    const route = tabRoutes[tab];
    if (route) navigate(route);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-[48px] bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
        <div className="font-mono text-[13px] font-medium tracking-tight select-none">
          clawd·studio
        </div>

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

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="font-mono text-[11px] text-muted-foreground">
              agent · ready
            </span>
          </div>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="h-[30px] px-3 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            New Project
          </button>
          <button
            onClick={signOut}
            className="h-[30px] px-3 gallery-border text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>
      <NewProjectModal open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </>
  );
};

export default TopNav;
