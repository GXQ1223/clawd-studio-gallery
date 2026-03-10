import { useState } from "react";
import { journalFeed } from "@/data/journal-data";
import AgentInputBar from "@/components/workspace/AgentInputBar";

const JournalView = () => {
  const [input, setInput] = useState("");
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 pb-32 pt-6">
          {journalFeed.map((entry) => (
            <div key={entry.id} className="py-4">
              {entry.type === "system" && (
                <div className="flex justify-center">
                  <span className="font-mono text-[11px] text-muted-foreground/50">{entry.text}</span>
                </div>
              )}
              {entry.type === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[70%] px-5 py-4" style={{ background: "rgba(0,0,0,0.03)" }}>
                    <p className="text-[14px] leading-relaxed">{entry.text}</p>
                    <span className="font-mono text-[10px] text-muted-foreground/40 mt-2 block text-right">{entry.time}</span>
                  </div>
                </div>
              )}
              {entry.type === "agent" && (
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="mt-[2px] text-[10px] opacity-40 select-none">★</span>
                    <span className="text-[14px] leading-relaxed flex-1">{entry.text}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">{entry.time}</span>
                  </div>
                </div>
              )}
              {entry.type === "upload" && (
                <div className="flex items-center gap-3">
                  <div className="w-[56px] h-[56px] bg-secondary flex items-center justify-center shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground">file</span>
                  </div>
                  <div>
                    <span className="font-mono text-[12px]">{entry.fileName}</span>
                    <div className="font-mono text-[10px] text-muted-foreground/40 mt-1">{entry.time}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 bg-background" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="max-w-[800px] mx-auto px-6 py-3">
          <AgentInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={() => { setInput(""); }}
          />
        </div>
      </div>
    </div>
  );
};

export default JournalView;
