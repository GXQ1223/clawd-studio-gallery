import { useState, useEffect, useRef } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { projects } from "@/data/projects";
import { journalFeed, type JournalEntry } from "@/data/journal-data";
import { ArrowLeft } from "lucide-react";

/* ── Visual placeholders (reused patterns) ── */

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
    <line x1="55%" y1="15%" x2="55%" y2="45%" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
    <path d="M 55% 70% Q 65% 70% 65% 60%" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.8" strokeDasharray="3 2" />
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
let gradientIdx = 0;

const ImagePlaceholder = ({ style }: { style: "render" | "plan" | "sketch" }) => {
  if (style === "plan") {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16/10", background: "#fafafa" }}>
        <PlanLines />
      </div>
    );
  }
  if (style === "sketch") {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16/10", background: "#f5f3f0" }}>
        <SketchLines />
      </div>
    );
  }
  const bg = renderGradients[gradientIdx++ % renderGradients.length];
  return <div className="w-full" style={{ aspectRatio: "16/10", background: bg }} />;
};

/* ── Card Components ── */

const SystemCard = ({ entry }: { entry: JournalEntry }) => (
  <div className="py-6 flex justify-center">
    <span className="font-mono text-[11px] text-muted-foreground/50">{entry.text}</span>
  </div>
);

const UserCard = ({ entry }: { entry: JournalEntry }) => (
  <div className="flex justify-end py-4">
    <div className="max-w-[70%] px-5 py-4" style={{ background: "rgba(0,0,0,0.03)" }}>
      <p className="text-[14px] leading-relaxed">{entry.text}</p>
      <span className="font-mono text-[10px] text-muted-foreground/40 mt-2 block text-right">{entry.time}</span>
    </div>
  </div>
);

const UploadCard = ({ entry }: { entry: JournalEntry }) => (
  <div className="py-4">
    <div className="flex items-center gap-3">
      <div className="w-[56px] h-[56px] bg-secondary flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div>
        <span className="font-mono text-[12px]">{entry.fileName}</span>
        {entry.fileCategory && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground/60 gallery-border px-1.5 py-0.5">
            {entry.fileCategory}
          </span>
        )}
        <div className="font-mono text-[10px] text-muted-foreground/40 mt-1">{entry.time}</div>
      </div>
    </div>
  </div>
);

const AgentCard = ({ entry }: { entry: JournalEntry }) => (
  <div className="py-5">
    {/* Header */}
    <div className="flex items-start gap-2 mb-2">
      <span className="mt-[2px] shrink-0 text-[10px] opacity-40 select-none">
        {entry.inProgress ? undefined : "★"}
      </span>
      {entry.inProgress && (
        <span className="mt-[5px] shrink-0 status-dot status-dot-agent animate-pulse-dot" />
      )}
      <span className={`text-[14px] leading-relaxed flex-1 ${entry.inProgress ? "text-muted-foreground" : ""}`}>
        {entry.text}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0 mt-[2px]">{entry.time}</span>
    </div>

    {/* Content */}
    {entry.contentType === "image" && entry.imageStyle && (
      <div className="mt-3">
        <ImagePlaceholder style={entry.imageStyle} />
      </div>
    )}

    {entry.contentType === "product" && (
      <div className="mt-3 flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.015)" }}>
        <div className="w-[40px] h-[40px] shrink-0" style={{ background: "linear-gradient(135deg, #c9c0b4, #a89880)" }} />
        <div>
          <span className="text-[13px] font-medium">{entry.productName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[12px]">{entry.productPrice}</span>
            <span className="font-mono text-[10px] text-muted-foreground/50">{entry.productSource}</span>
          </div>
        </div>
      </div>
    )}
  </div>
);

/* ── Main Page ── */

const ProjectJournal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState(journalFeed);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  if (!project) return <Navigate to="/" replace />;

  const handleSubmit = () => {
    if (!input.trim()) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, type: "user" as const, time, text: input },
    ]);
    setInput("");
    // Simulate agent response
    setTimeout(() => {
      setEntries((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, type: "agent" as const, time, text: "Processing...", contentType: "none", inProgress: true },
      ]);
    }, 600);
  };

  const suggestions = ["Generate section view", "Client hates yellow", "Find dining chairs"];
  const folderCount = project.folders?.reduce((sum, f) => sum + f.count, 0) ?? 0;
  const folderCategories = project.folders?.length ?? 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => navigate("/")} className="font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            Projects
          </button>
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

      {/* Context bar */}
      <div className="h-[48px] shrink-0 flex items-center px-5 gap-5 gallery-border border-t-0 border-l-0 border-r-0">
        {project.dimensions && (
          <span className="font-mono text-[11px] text-muted-foreground">{project.dimensions}</span>
        )}
        {project.budget && (
          <span className="font-mono text-[11px] text-muted-foreground">
            ${project.budget.toLocaleString()}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="status-dot status-dot-draft" />
          <span className="font-mono text-[11px] text-muted-foreground">Design Development</span>
        </span>
        {folderCount > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {folderCount} files across {folderCategories} categories
          </span>
        )}
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 pb-32">
          {entries.map((entry) => {
            switch (entry.type) {
              case "system":
                return <SystemCard key={entry.id} entry={entry} />;
              case "user":
                return <UserCard key={entry.id} entry={entry} />;
              case "upload":
                return <UploadCard key={entry.id} entry={entry} />;
              case "agent":
                return <AgentCard key={entry.id} entry={entry} />;
              default:
                return null;
            }
          })}
        </div>
      </div>

      {/* Fixed bottom input */}
      <div className="shrink-0 bg-background" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="max-w-[800px] mx-auto px-6 py-3 space-y-2">
          {/* Suggestion chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="px-2 py-0.5 font-mono text-[10px] text-muted-foreground gallery-border hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          {/* Input row */}
          <div className="flex items-center gap-3">
            {/* Mic */}
            <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Direct the agent..."
              className="flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/40 focus:outline-none font-sans"
            />
            {/* Attach */}
            <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectJournal;
