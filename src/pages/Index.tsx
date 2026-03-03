import { useState } from "react";
import TopNav from "@/components/TopNav";
import Toolbar from "@/components/Toolbar";
import ProjectGrid from "@/components/ProjectGrid";
import BottomStrip from "@/components/BottomStrip";

type Filter = "all" | "active" | "draft" | "complete";

const Index = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <Toolbar
        activeFilter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        total={8}
      />
      <ProjectGrid filter={filter} viewMode={viewMode} />
      <BottomStrip />
    </div>
  );
};

export default Index;
