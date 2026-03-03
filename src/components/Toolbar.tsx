import { useState } from "react";
import { Grid3X3, List } from "lucide-react";

type Filter = "all" | "active" | "draft" | "complete";

interface ToolbarProps {
  activeFilter: Filter;
  onFilterChange: (f: Filter) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
  total: number;
}

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "In Progress", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Complete", value: "complete" },
];

const Toolbar = ({ activeFilter, onFilterChange, viewMode, onViewModeChange, total }: ToolbarProps) => {
  return (
    <div className="fixed top-[48px] left-0 right-0 z-40 h-[48px] bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <span className="text-[14px] font-medium">Projects</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {String(total).padStart(2, "0")} total
        </span>
        <div className="flex items-center gap-1 ml-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-2.5 py-1 text-[11px] font-sans transition-colors ${
                activeFilter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            + Filter
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">sort: recent</span>
        <div className="flex items-center gallery-border">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 transition-colors ${
              viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 transition-colors ${
              viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
