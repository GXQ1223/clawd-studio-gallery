import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const templates = [
  { label: "Living Room", icon: "🛋", brief: "Modern living room with comfortable seating, natural light, warm neutrals" },
  { label: "Kitchen", icon: "🍳", brief: "Contemporary kitchen with island, pendant lights, marble countertops" },
  { label: "Office", icon: "💼", brief: "Professional office space with ergonomic furniture, clean lines" },
  { label: "Restaurant", icon: "🍽", brief: "Upscale restaurant interior with ambient lighting, rich textures" },
  { label: "Landscape", icon: "🌿", brief: "Residential landscape with pathways, native planting, outdoor seating" },
  { label: "Bedroom", icon: "🛏", brief: "Serene master bedroom with layered textiles, soft palette" },
];

interface Props {
  projectName: string;
  onSubmitBrief: (brief: string) => void;
  onFilesUploaded?: (urls: string[]) => void;
  projectId?: string;
  isWorking?: boolean;
}

const EmptyBriefPrompt = ({ projectName, onSubmitBrief, onFilesUploaded, projectId, isWorking }: Props) => {
  const [brief, setBrief] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!projectId) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("project-assets").upload(path, file);
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    if (urls.length > 0) {
      setUploadedFiles(prev => [...prev, ...urls]);
      onFilesUploaded?.(urls);
      toast.success(`${urls.length} reference(s) uploaded`);
    }
  }, [projectId, onFilesUploaded]);

  const handleSubmit = () => {
    if (!brief.trim()) return;
    onSubmitBrief(brief.trim());
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-[560px] space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-[28px] font-medium tracking-tight">{projectName}</h1>
          <p className="text-[14px] text-muted-foreground">What are you designing?</p>
        </div>

        {/* Main input */}
        <div className="space-y-3">
          <div
            className={`relative gallery-border transition-colors ${isDragging ? "bg-secondary" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
          >
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe your project — style, materials, mood, budget…"
              className="w-full h-[120px] px-4 py-3 bg-transparent text-[14px] placeholder:text-muted-foreground/40 focus:outline-none resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Add references
              </button>
              <button
                onClick={handleSubmit}
                disabled={!brief.trim() || isWorking}
                className="h-[30px] px-4 bg-foreground text-background font-mono text-[11px] hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {isWorking ? "Working…" : "Start designing ✦"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.dwg,.skp"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* Uploaded file previews */}
          {uploadedFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {uploadedFiles.map((url, i) => (
                <img key={i} src={url} alt="ref" className="w-[48px] h-[48px] object-cover gallery-border" />
              ))}
            </div>
          )}
        </div>

        {/* Quick-start templates */}
        <div className="space-y-3">
          <p className="text-center font-mono text-[11px] text-muted-foreground">or start with a template</p>
          <div className="grid grid-cols-3 gap-2">
            {templates.map((t) => (
              <button
                key={t.label}
                onClick={() => setBrief(t.brief)}
                className="flex items-center gap-2 px-3 py-2.5 gallery-border text-left hover:bg-secondary transition-colors"
              >
                <span className="text-[16px]">{t.icon}</span>
                <span className="text-[12px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyBriefPrompt;
