import { useState } from "react";
import { deckSlides } from "@/data/deck-data";

const DeckView = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = deckSlides[currentSlide];
  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[800px]" style={{ aspectRatio: "16/9", background: "#fff", boxShadow: "0 2px 20px rgba(0,0,0,0.06)" }}>
          <div className="w-full h-full flex items-center justify-center p-8">
            <div className="text-center">
              <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">{slide.type}</div>
              <div className="text-[18px] font-medium">{slide.label}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">←</button>
          {deckSlides.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-foreground" : "bg-muted-foreground/30"}`} />
          ))}
          <button onClick={() => setCurrentSlide(Math.min(deckSlides.length - 1, currentSlide + 1))} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">→</button>
        </div>
      </div>
      <div className="w-[240px] shrink-0 gallery-border border-t-0 border-b-0 border-r-0 overflow-y-auto p-3 space-y-2">
        {deckSlides.map((s, i) => (
          <button key={s.id} onClick={() => setCurrentSlide(i)} className={`w-full text-left p-2 transition-colors ${i === currentSlide ? "bg-secondary" : "hover:bg-secondary/50"}`}>
            <div className="font-mono text-[10px] text-muted-foreground/50">{String(i + 1).padStart(2, "0")}</div>
            <div className="text-[12px] font-medium truncate">{s.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground/40">{s.type}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DeckView;
