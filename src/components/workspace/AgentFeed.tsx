import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/data/workspace-data";
import type { OrchestrationResult } from "@/lib/designerAgent";
import AgentInputBar, { type Attachment } from "./AgentInputBar";

interface Props {
  feed: FeedEntry[];
  onSubmit?: (text: string, attachments: Attachment[]) => void;
  isWorking?: boolean;
  results?: OrchestrationResult | null;
}

const AgentFeed = ({ feed, onSubmit, isWorking, results }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feed, results]);

  const handleSubmit = (text: string, attachments: Attachment[]) => {
    if (!text.trim() && attachments.length === 0) return;
    if (onSubmit) {
      onSubmit(text, attachments);
    }
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
        {feed.map((entry, i) => (
          <div key={entry.id} className="py-2 flex gap-2 items-start">
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

        {/* Render results */}
        {results && results.renders.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Renders</p>
            <div className="grid grid-cols-2 gap-1.5">
              {results.renders.map((r) => (
                <div key={r.id} className="group relative">
                  <img
                    src={r.url}
                    alt={r.label}
                    className="w-full aspect-[4/3] object-cover rounded"
                    style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product results */}
        {results && results.products.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Shopping List</p>
            <div className="space-y-1.5">
              {results.products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors"
                  style={{ border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <img src={p.image} alt={p.name} className="w-[36px] h-[36px] rounded object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.brand} · ${p.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {results.shoppingList && (
                <div className="pt-1 flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{results.shoppingList.item_count} items</span>
                  <span className="font-medium text-foreground">${results.shoppingList.total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <AgentInputBar
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          suggestions={isWorking ? undefined : suggestions}
          compact
        />
      </div>
    </aside>
  );
};

export default AgentFeed;
