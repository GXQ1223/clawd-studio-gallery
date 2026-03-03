import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/data/workspace-data";

interface Props {
  feed: FeedEntry[];
}

const AgentFeed = ({ feed }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState(feed);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, time, text: input, inProgress: true },
    ]);
    setInput("");
  };

  const suggestions = ["Japandi palette", "Client hates yellow", "Generate section"];

  return (
    <aside
      className="w-[320px] shrink-0 h-full flex flex-col"
      style={{ borderLeft: "2px solid rgba(0,0,0,0.08)" }}
    >
      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="py-2 flex gap-2 items-start"
            style={{
              animation: i >= feed.length ? "fade-in 0.3s ease-out" : undefined,
            }}
          >
            <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-[2px] w-[36px]">
              {entry.time}
            </span>
            <span className="flex items-start gap-1.5 text-[12px] leading-relaxed">
              {entry.inProgress ? (
                <span className="mt-[5px] shrink-0 status-dot status-dot-agent animate-pulse-dot" />
              ) : (
                <span className="mt-[3px] shrink-0 text-[10px] opacity-40 select-none">★</span>
              )}
              <span className={entry.inProgress ? "text-muted-foreground" : "text-foreground"}>
                {entry.text}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
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

        {/* Input */}
        <div className="flex items-center gap-2">
          <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
            className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/50 focus:outline-none font-sans"
          />
        </div>
      </div>
    </aside>
  );
};

export default AgentFeed;
