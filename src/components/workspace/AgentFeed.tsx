import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/data/workspace-data";
import AgentInputBar, { type Attachment } from "./AgentInputBar";

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

  const handleSubmit = (text: string, _attachments: Attachment[]) => {
    if (!text.trim() && _attachments.length === 0) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, time, text: text || "(image attachment)", inProgress: true },
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
      <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <AgentInputBar
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          suggestions={suggestions}
          compact
        />
      </div>
    </aside>
  );
};

export default AgentFeed;
