import { useState, useRef, useEffect, useCallback } from "react";

export interface Attachment {
  id: string;
  file: File;
  url: string;
}

interface Props {
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: (text: string, attachments: Attachment[]) => void;
  suggestions?: string[];
  /** Compact mode for sidebars (smaller icons/text) */
  compact?: boolean;
  /** Inline mode for bottom status bars (no suggestions, minimal height) */
  inline?: boolean;
}

const PaperclipIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const MicIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const SendIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" x2="11" y1="2" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const AgentInputBar = ({
  input,
  onInputChange,
  onSubmit,
  suggestions,
  compact = false,
  inline = false,
}: Props) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const hasContent = input.trim().length > 0 || attachments.length > 0;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Revoke remaining Object URLs on unmount
  useEffect(() => {
    return () => {
      setAttachments((prev) => {
        prev.forEach((a) => URL.revokeObjectURL(a.url));
        return [];
      });
    };
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    setMenuOpen(false);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "clipboard-image.png", { type: imageType });
          addFiles(new DataTransfer().files); // won't work, use direct
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}`,
              file,
              url: URL.createObjectURL(file),
            },
          ]);
        }
      }
    } catch {
      // clipboard API not available or no image
    }
    setMenuOpen(false);
  };

  const handleSubmit = () => {
    if (!hasContent) return;
    onSubmit(input, attachments);
    onInputChange("");
    setAttachments([]);
  };

  const iconSize = compact ? 16 : inline ? 16 : 18;
  const textSize = compact ? "text-[13px]" : inline ? "text-[12px]" : "text-[14px]";
  const fontClass = inline ? "font-mono" : "font-sans";

  return (
    <div className="space-y-2">
      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && !inline && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onInputChange(s)}
              className="px-2 py-0.5 font-mono text-[10px] text-muted-foreground gallery-border hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {attachments.map((att) => (
            <div key={att.id} className="relative group">
              <img
                src={att.url}
                alt="attachment"
                className="w-[80px] h-[80px] object-cover rounded-lg"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
              />
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 w-[20px] h-[20px] rounded-full bg-foreground text-background text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Attachment button */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <PaperclipIcon size={iconSize} />
          </button>

          {/* Popup menu */}
          {menuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-[200px] bg-background py-1.5 z-50"
              style={{
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                animation: "fade-in 0.15s ease-out",
              }}
            >
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-[14px]">📷</span>
                <span>Take photo</span>
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-[14px]">🖼</span>
                <span>Upload image</span>
              </button>
              <button
                onClick={handlePaste}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-[14px]">📋</span>
                <span>Paste from clipboard</span>
              </button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Mic */}
        <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          <MicIcon size={iconSize} />
        </button>

        {/* Text input */}
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={attachments.length > 0 ? "Add a note about this image..." : "Direct the agent..."}
          className={`flex-1 bg-transparent ${textSize} placeholder:text-muted-foreground/40 focus:outline-none ${fontClass}`}
        />

        {/* Send button — visible on focus or when there's content */}
        {(focused || hasContent) && (
          <button
            onClick={handleSubmit}
            className={`shrink-0 transition-colors ${
              hasContent
                ? "text-foreground"
                : "text-muted-foreground/30"
            }`}
          >
            <SendIcon size={iconSize} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentInputBar;
