import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface Props {
  projectName: string;
}

const WorkspaceNav = ({ projectName }: Props) => {
  const navigate = useNavigate();

  return (
    <header className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
      {/* Left: back + name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={() => navigate("/")}
          className="font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Projects
        </button>
        <span className="text-muted-foreground/30 text-[12px]">/</span>
        <span className="text-[13px] font-medium truncate max-w-[200px]">{projectName}</span>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3">
        <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">
          View Deck
        </button>
        <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">
          Share
        </button>
        <div className="flex items-center gap-2 ml-2">
          <span className="status-dot status-dot-active animate-pulse-dot" />
          <span className="font-mono text-[11px] text-muted-foreground">agent</span>
        </div>
      </div>
    </header>
  );
};

export default WorkspaceNav;
