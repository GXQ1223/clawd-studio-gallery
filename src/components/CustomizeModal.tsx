import { useState, useRef, useCallback, useEffect } from "react";
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

type InputMode = "text" | "image" | "voice";
type VoiceState = "idle" | "recording" | "done";

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
  const [mode, setMode] = useState<InputMode>("text");

  // Image state
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMode("text");
      setImageFile(null);
      setImageNote("");
      setVoiceState("idle");
      setTranscript("");
    }
  }, [open]);

  const handleChipClick = (index: number) => {
    setActiveChip(index);
    setInput(quickPicks[index].text);
  };

  const handleGenerate = () => {
    let text = input;
    if (mode === "image") text = imageNote || "sourcing";
    const result = parseInput(text);
    onOpenChange(false);
    setInput("");
    setActiveChip(null);
    onGenerate(result);
  };

  // Revoke previous Object URL before setting a new one, and on unmount
  const setImageWithCleanup = useCallback((url: string | null) => {
    setImageFile((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  useEffect(() => {
    return () => {
      // Clean up any remaining Object URL on unmount
      setImageFile((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, []);

  // Image handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      setImageWithCleanup(URL.createObjectURL(file));
    }
  }, [setImageWithCleanup]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setImageWithCleanup(URL.createObjectURL(file));
        }
      }
    }
  }, [setImageWithCleanup]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith("image/")) {
      setImageWithCleanup(URL.createObjectURL(file));
    }
  };

  // Voice handlers
  const startRecording = () => {
    const SpeechRecognitionCtor = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setTranscript("Speech recognition not supported in this browser.");
      setVoiceState("done");
      return;
    }
    const recognition = new (SpeechRecognitionCtor as any)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    recognition.onerror = () => {
      setVoiceState("done");
    };
    recognition.onend = () => {
      setVoiceState("done");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setVoiceState("recording");
    setTranscript("");
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setVoiceState("done");
  };

  const handleMicClick = () => {
    if (voiceState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleReRecord = () => {
    setTranscript("");
    setVoiceState("idle");
  };

  const handleUseTranscript = () => {
    setInput(transcript);
    setMode("text");
  };

  // Auto-switch to text after transcript
  useEffect(() => {
    if (voiceState === "done" && transcript) {
      setInput(transcript);
    }
  }, [voiceState, transcript]);

  const canGenerate =
    (mode === "text" && input.trim().length > 0) ||
    (mode === "image" && imageFile !== null) ||
    (mode === "voice" && voiceState === "done" && transcript.length > 0);

  const generateLabel =
    mode === "image" ? "Generate from Image ✦" : "Generate Display ✦";

  const showGenerateBtn = !(mode === "voice" && voiceState === "recording");

  const tabs: { key: InputMode; label: string }[] = [
    { key: "text", label: "Text" },
    { key: "image", label: "Image" },
    { key: "voice", label: "Voice" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 border border-border shadow-none backdrop-blur-sm gap-0 rounded-none">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-[16px] font-medium font-sans">
            Customize your workspace
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground mt-1">
            Describe how you work. The agent will build your display.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex items-center gap-4 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`pb-2 text-[12px] font-mono transition-colors relative ${
                  mode === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {mode === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground" />
                )}
              </button>
            ))}
          </div>

          {/* TEXT TAB */}
          {mode === "text" && (
            <>
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
            </>
          )}

          {/* IMAGE TAB */}
          {mode === "image" && (
            <div onPaste={handlePaste}>
              {!imageFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-[160px] border border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 transition-colors"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-2">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span className="text-[13px] text-muted-foreground">Drop a reference image or paste one</span>
                  <span className="text-[11px] text-muted-foreground/50 mt-1">Show the agent how you want your workspace to look</span>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </div>
              ) : (
                <div className="relative border border-border rounded-lg overflow-hidden">
                  <img src={imageFile} alt="Reference" className="w-full h-[160px] object-cover" />
                  <button
                    onClick={() => setImageWithCleanup(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-[12px] hover:opacity-80"
                  >
                    ×
                  </button>
                </div>
              )}
              <input
                value={imageNote}
                onChange={(e) => setImageNote(e.target.value)}
                placeholder="Add a note about this image (optional)"
                className="w-full mt-3 bg-transparent text-[13px] font-sans placeholder:text-muted-foreground/40 focus:outline-none border border-border px-3 py-2"
              />
            </div>
          )}

          {/* VOICE TAB */}
          {mode === "voice" && (
            <div className="flex flex-col items-center py-4">
              <button
                onClick={handleMicClick}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  voiceState === "recording"
                    ? "bg-red-500 animate-pulse"
                    : "bg-foreground"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-background">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>

              {voiceState === "idle" && (
                <span className="text-[12px] text-muted-foreground mt-3">Tap to speak. Tell the agent how you work.</span>
              )}

              {voiceState === "recording" && (
                <div className="flex flex-col items-center mt-3 gap-2">
                  <span className="text-[12px] text-foreground font-medium">Listening...</span>
                  <div className="flex items-end gap-1 h-4">
                    <span className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: "12px", animationDelay: "0ms" }} />
                    <span className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: "18px", animationDelay: "150ms" }} />
                    <span className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: "10px", animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {voiceState === "done" && transcript && (
                <div className="w-full mt-4 space-y-2">
                  <div className="bg-secondary/50 border border-border px-3 py-2.5 text-[13px] font-mono text-foreground rounded">
                    {transcript}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleReRecord} className="text-[12px] text-muted-foreground hover:text-foreground underline">
                      Re-record
                    </button>
                    <button onClick={handleUseTranscript} className="text-[12px] text-muted-foreground hover:text-foreground underline">
                      Edit as text
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-[34px] px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            {showGenerateBtn && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="h-[34px] px-4 bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generateLabel}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomizeModal;
