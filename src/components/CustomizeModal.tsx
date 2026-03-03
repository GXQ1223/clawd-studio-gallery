import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const quickPicks = [
  { label: "Sourcing-focused", desc: "products + budget prominent", text: "I want sourcing front and center with the budget always visible and products as the main focus" },
  { label: "Presentation-ready", desc: "deck view, always client-facing", text: "I want a presentation-ready layout, always client-facing with the deck view as primary" },
  { label: "Detail work", desc: "full studio, all folders visible", text: "I want full detail studio mode with all folders visible and everything accessible" },
  { label: "Minimal", desc: "just the feed and latest image", text: "I want a minimal simple layout with just the feed and the latest image" },
];

export type CustomizeResult = "studio" | "journal" | "wall" | "deck";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (result: CustomizeResult) => void;
}

function parseInput(text: string): CustomizeResult {
  const lower = text.toLowerCase();
  if (lower.includes("sourcing") || lower.includes("budget")) return "studio";
  if (lower.includes("presentation") || lower.includes("deck") || lower.includes("client")) return "deck";
  if (lower.includes("minimal") || lower.includes("simple") || lower.includes("feed")) return "journal";
  if (lower.includes("detail") || lower.includes("studio") || lower.includes("all")) return "studio";
  return "studio";
}

const CustomizeModal = ({ open, onOpenChange, onGenerate }: Props) => {
  const [input, setInput] = useState("");
  const [activeChip, setActiveChip] = useState<number | null>(null);

  const handleChipClick = (index: number) => {
    setActiveChip(index);
    setInput(quickPicks[index].text);
  };

  const handleGenerate = () => {
    const result = parseInput(input);
    onOpenChange(false);
    setInput("");
    setActiveChip(null);
    onGenerate(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 border border-border shadow-none backdrop-blur-sm gap-0 rounded-none">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-[16px] font-medium font-sans">
            Customize your workspace
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground mt-1">
            Describe how you work. The agent will build your display.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-5 space-y-4">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setActiveChip(null); }}
            rows={4}
            placeholder="e.g. I want sourcing front and center with the floor plan always visible and the agent feed collapsed by default..."
            className="w-full bg-transparent text-[14px] font-sans placeholder:text-muted-foreground/40 focus:outline-none resize-none border border-border px-3 py-2.5"
          />

          <div className="flex flex-wrap gap-2">
            {quickPicks.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleChipClick(i)}
                className={`px-3 py-1.5 text-[12px] font-mono transition-colors border ${
                  activeChip === i
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {chip.label}
                <span className="text-[10px] ml-1 opacity-60">— {chip.desc}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-[34px] px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!input.trim()}
              className="h-[34px] px-4 bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Display ✦
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomizeModal;
