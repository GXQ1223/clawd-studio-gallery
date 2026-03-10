import { useState, useEffect, useRef } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useProject } from "@/hooks/useProjects";
import { type JournalEntry } from "@/data/journal-data";
import { ArrowLeft, Loader2 } from "lucide-react";
import AgentInputBar, { type Attachment } from "@/components/workspace/AgentInputBar";
import { supabase } from "@/integrations/supabase/client";

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

const ImagePlaceholder = ({ style, imageUrl }: { style: "render" | "plan" | "sketch"; imageUrl?: string }) => {
  if (imageUrl) {
    return <img src={imageUrl} alt="Render" className="w-full" style={{ aspectRatio: "16/10", objectFit: "cover" }} />;
  }
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
    {entry.contentType === "image" && (
      <div className="mt-3">
        <ImagePlaceholder style={entry.imageStyle || "render"} imageUrl={entry.imageUrl} />
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

/* ── Map agent_messages to JournalEntry ── */

interface AgentMessageRow {
  id: string;
  message_type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

function mapMessageToJournalEntry(msg: AgentMessageRow): JournalEntry {
  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  const meta = (msg.metadata || {}) as Record<string, unknown>;

  // User messages
  if (msg.message_type === "user_message") {
    return { id: msg.id, type: "user", time, text: msg.content };
  }

  // Result messages with renders
  if (msg.message_type === "result" && meta.renders) {
    const renders = meta.renders as Array<{ url?: string; label?: string }>;
    const firstRender = renders[0];
    return {
      id: msg.id,
      type: "agent",
      time,
      text: msg.content,
      contentType: "image",
      imageStyle: "render",
      imageUrl: firstRender?.url,
    };
  }

  // Result messages with products
  if (msg.message_type === "result" && meta.products) {
    const products = meta.products as Array<{ name?: string; price?: number; brand?: string }>;
    const firstProduct = products[0];
    if (firstProduct) {
      return {
        id: msg.id,
        type: "agent",
        time,
        text: msg.content,
        contentType: "product",
        productName: firstProduct.name || "Product",
        productPrice: firstProduct.price ? `$${firstProduct.price.toLocaleString()}` : "",
        productSource: firstProduct.brand || "",
      };
    }
  }

  // Coordination messages (agent spawning)
  if (msg.message_type === "coordination") {
    return { id: msg.id, type: "system", time, text: msg.content };
  }

  // Status updates — detect image-related content
  const content = msg.content.toLowerCase();
  let contentType: "image" | "product" | "analysis" | "none" = "none";
  let imageStyle: "render" | "plan" | "sketch" | undefined;

  if (content.includes("render") || content.includes("perspective") || content.includes("generated")) {
    contentType = "image";
    imageStyle = "render";
  } else if (content.includes("plan") || content.includes("layout")) {
    contentType = "image";
    imageStyle = "plan";
  } else if (content.includes("found") && content.includes("$")) {
    contentType = "product";
  } else if (content.includes("analyz") || content.includes("brief")) {
    contentType = "analysis";
  }

  return {
    id: msg.id,
    type: "agent",
    time,
    text: msg.content,
    contentType,
    imageStyle,
  };
}

/* ── Main Page ── */

const ProjectJournal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch live agent_messages from Supabase
  useEffect(() => {
    if (!id) return;
    setIsLoadingMessages(true);
    setLoadError(null);

    supabase
      .from("agent_messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load journal messages:", error);
          setLoadError("Failed to load journal entries");
          setIsLoadingMessages(false);
          return;
        }

        if (data && data.length > 0) {
          const mapped = (data as AgentMessageRow[]).map(mapMessageToJournalEntry);
          setEntries(mapped);
        } else {
          setEntries([{
            id: "empty",
            type: "system",
            time: "",
            text: "No activity yet — submit a brief in the workspace to get started",
          }]);
        }
        setIsLoadingMessages(false);
      });
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-background"><span className="font-mono text-[12px] text-muted-foreground animate-pulse">loading…</span></div>;
  if (!project) return <Navigate to="/" replace />;

  const handleSubmit = (text: string, _attachments: Attachment[]) => {
    if (!text.trim() && _attachments.length === 0) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, type: "user" as const, time, text: text || "(image attachment)" },
    ]);
    setInput("");
    setTimeout(() => {
      setEntries((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, type: "agent" as const, time, text: "Processing...", contentType: "none", inProgress: true },
      ]);
    }, 600);
  };

  const suggestions = ["Generate section view", "Client hates yellow", "Find dining chairs"];
  const folderCount = project.folders?.reduce((sum: number, f: { count: number }) => sum + f.count, 0) ?? 0;
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
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
              <span className="ml-3 font-mono text-[12px] text-muted-foreground">Loading journal…</span>
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center py-20">
              <span className="font-mono text-[12px] text-destructive">{loadError}</span>
            </div>
          ) : (
            entries.map((entry) => {
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
            })
          )}
        </div>
      </div>

      {/* Fixed bottom input */}
      <div className="shrink-0 bg-background" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="max-w-[800px] mx-auto px-6 py-3">
          <AgentInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            suggestions={suggestions}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectJournal;
