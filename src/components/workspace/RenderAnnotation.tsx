import { useState, useCallback, useRef } from "react";

export interface Annotation {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  text: string;
  createdAt: string;
}

interface Props {
  renderUrl: string;
  renderLabel: string;
  annotations: Annotation[];
  onAddAnnotation: (x: number, y: number, text: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

const RenderAnnotation = ({ renderUrl, renderLabel, annotations, onAddAnnotation, onClose, readOnly }: Props) => {
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setCommentText("");
  }, [readOnly]);

  const handleSubmitComment = useCallback(() => {
    if (!pendingPin || !commentText.trim()) return;
    onAddAnnotation(pendingPin.x, pendingPin.y, commentText.trim());
    setPendingPin(null);
    setCommentText("");
  }, [pendingPin, commentText, onAddAnnotation]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background max-w-[900px] w-full max-h-[90vh] flex flex-col" style={{ border: "1px solid hsl(var(--border))" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <span className="text-[13px] font-medium">{renderLabel}</span>
          <div className="flex items-center gap-3">
            {!readOnly && (
              <span className="font-mono text-[10px] text-muted-foreground">Click image to add annotation</span>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Image with pins */}
        <div className="flex-1 overflow-auto p-4">
          <div ref={imageRef} className="relative cursor-crosshair inline-block" onClick={handleImageClick}>
            <img src={renderUrl} alt={renderLabel} className="max-w-full max-h-[60vh] object-contain" />

            {/* Existing annotations */}
            {annotations.map((a, i) => (
              <div
                key={a.id}
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-mono font-bold shadow-md group"
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
                title={a.text}
              >
                {i + 1}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-foreground text-background px-2 py-1 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {a.text}
                </div>
              </div>
            ))}

            {/* Pending pin */}
            {pendingPin && (
              <div
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-mono font-bold shadow-md animate-pulse"
                style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
              >
                +
              </div>
            )}
          </div>
        </div>

        {/* Comment input for pending pin */}
        {pendingPin && (
          <div className="px-4 py-3 shrink-0 flex gap-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
              placeholder="Add your comment…"
              className="flex-1 h-[32px] px-3 bg-secondary text-[12px] font-mono focus:outline-none"
              style={{ border: "1px solid hsl(var(--border))" }}
              autoFocus
            />
            <button onClick={handleSubmitComment} disabled={!commentText.trim()} className="h-[32px] px-4 bg-foreground text-background text-[11px] font-mono disabled:opacity-50">
              Add
            </button>
            <button onClick={() => setPendingPin(null)} className="h-[32px] px-3 gallery-border text-[11px] font-mono text-muted-foreground">
              Cancel
            </button>
          </div>
        )}

        {/* Annotation list */}
        {annotations.length > 0 && (
          <div className="px-4 py-3 shrink-0 space-y-1.5 max-h-[150px] overflow-y-auto" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            {annotations.map((a, i) => (
              <div key={a.id} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center text-[9px] font-mono font-bold shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-[11px]">{a.text}</p>
                  <span className="font-mono text-[9px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RenderAnnotation;
