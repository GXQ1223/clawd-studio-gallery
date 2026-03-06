import { useState, useRef, useCallback } from "react";
import type { Asset } from "@/data/workspace-data";
import PrimaryVersionLayout from "./PrimaryVersionLayout";
import ModelViewerPlaceholder from "./ModelViewerPlaceholder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  assets: Asset[];
  activeFolder: string | null;
  availableCategories?: string[];
  onAssetDelete?: (id: string) => void;
  onAssetRefine?: (asset: Asset) => void;
  onFilesUploaded?: (urls: string[]) => void;
  projectId?: string;
}

const categoryGradients: Record<string, { bg: string; style: string }> = {
  perspective: { bg: "linear-gradient(135deg, #c9c0b4 0%, #a89880 100%)", style: "render" },
  plan: { bg: "#fafafa", style: "plan" },
  sketch: { bg: "#f5f3f0", style: "sketch" },
  elevation: { bg: "#fafafa", style: "elevation" },
  section: { bg: "#fafafa", style: "elevation" },
  "model photo": { bg: "linear-gradient(135deg, #c4c8cc 0%, #9aa0a8 100%)", style: "render" },
  "3d model": { bg: "linear-gradient(135deg, #c2cac0 0%, #96a892 100%)", style: "render" },
  misc: { bg: "#f0f0f0", style: "render" },
};

// Layouts that use PrimaryVersionLayout
const primaryVersionCategories = ["plan", "elevation", "section"];

const AssetCell = ({
  asset,
  onDelete,
  onRefine,
}: {
  asset: Asset;
  onDelete?: (id: string) => void;
  onRefine?: (asset: Asset) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const cat = categoryGradients[asset.category] || categoryGradients.misc;

  return (
    <div
      className="relative overflow-hidden cursor-pointer group"
      style={{ aspectRatio: asset.category === "plan" ? "1" : "4/3" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute inset-0" style={{ background: asset.imageUrl ? undefined : cat.bg }}>
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <>
            {cat.style === "plan" && <PlanLines />}
            {cat.style === "sketch" && <SketchLines />}
            {cat.style === "elevation" && <ElevationLines />}
          </>
        )}
      </div>

      {asset.aiGenerated && (
        <div className="absolute top-2 right-2 text-[14px] opacity-60 select-none">★</div>
      )}

      <div
        className="absolute inset-0 flex flex-col justify-end p-3 transition-opacity duration-200"
        style={{
          opacity: hovered ? 1 : 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)",
        }}
      >
        <span className="font-mono text-[10px] text-white/90">{asset.category}</span>
        <span className="font-mono text-[9px] text-white/60 mt-0.5">{asset.date}</span>
        {asset.aiGenerated && (
          <span className="font-mono text-[9px] text-amber-300/80 mt-0.5">ai generated</span>
        )}

        {/* Hover action buttons */}
        {(onDelete || onRefine) && (
          <div className="flex gap-1 mt-2">
            {onRefine && (
              <button
                onClick={(e) => { e.stopPropagation(); onRefine(asset); }}
                className="px-2 py-1 bg-white/90 text-foreground text-[9px] font-mono hover:bg-white transition-colors"
              >
                Refine
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
                className="px-2 py-1 bg-white/90 text-destructive text-[9px] font-mono hover:bg-white transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PlanLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`v${i}`} x1={`${(i + 1) * 12.5}%`} y1="10%" x2={`${(i + 1) * 12.5}%`} y2="90%" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`h${i}`} x1="10%" y1={`${(i + 1) * 12.5}%`} x2="90%" y2={`${(i + 1) * 12.5}%`} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
    ))}
    <rect x="15%" y="15%" width="70%" height="55%" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
    <rect x="15%" y="15%" width="40%" height="30%" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
    <line x1="55%" y1="15%" x2="55%" y2="45%" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
    <path d="M 55% 70% Q 65% 70% 65% 60%" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.8" strokeDasharray="3 2" />
  </svg>
);

const SketchLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 12 }).map((_, i) => (
      <line
        key={i}
        x1={`${10 + i * 7}%`}
        y1={`${15 + Math.sin(i) * 10}%`}
        x2={`${15 + i * 7}%`}
        y2={`${75 + Math.cos(i) * 8}%`}
        stroke="rgba(0,0,0,0.06)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    ))}
    <path d="M 20% 60% Q 40% 30% 60% 55% T 85% 40%" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.2" />
  </svg>
);

const ElevationLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 6 }).map((_, i) => (
      <line
        key={i}
        x1="12%"
        y1={`${20 + i * 12}%`}
        x2="88%"
        y2={`${20 + i * 12}%`}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.8"
      />
    ))}
    <rect x="25%" y="32%" width="20%" height="32%" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    <rect x="55%" y="32%" width="20%" height="32%" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
  </svg>
);

const AssetGallery = ({
  assets,
  activeFolder,
  availableCategories,
  onAssetDelete,
  onAssetRefine,
  onFilesUploaded,
  projectId,
}: Props) => {
  const [localFilter, setLocalFilter] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveFilter = activeFolder || localFilter;

  const filtered = effectiveFilter
    ? assets.filter((a) => a.category === effectiveFilter)
    : assets;

  // Build category pills from available categories only
  const categories = availableCategories && availableCategories.length > 0
    ? ["all", ...availableCategories]
    : ["all"];

  // File upload handler
  const handleFiles = useCallback(async (files: FileList) => {
    if (!projectId) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("project-assets").upload(path, file);
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    if (urls.length > 0) {
      toast.success(`${urls.length} file(s) uploaded`);
      onFilesUploaded?.(urls);
    }
  }, [projectId, onFilesUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Per-category layout switching
  if (activeFolder === "3d model") {
    return (
      <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-4">
        <ModelViewerPlaceholder />
      </div>
    );
  }

  if (activeFolder && primaryVersionCategories.includes(activeFolder)) {
    return (
      <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-4">
        <PrimaryVersionLayout
          assets={filtered}
          onDelete={onAssetDelete}
          onRefine={onAssetRefine}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-4">
      {/* Filter pills — only for existing categories */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setLocalFilter(cat === "all" ? null : cat)}
              className={`px-2 py-0.5 font-mono text-[11px] transition-colors ${
                (cat === "all" && !effectiveFilter) || effectiveFilter === cat
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground gallery-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Masonry grid */}
      <div className="columns-3 gap-[2px]" style={{ columnFill: "balance" }}>
        {filtered.map((asset) => (
          <div key={asset.id} className="mb-[2px] break-inside-avoid">
            <AssetCell
              asset={asset}
              onDelete={onAssetDelete}
              onRefine={onAssetRefine}
            />
          </div>
        ))}

        {/* Functional drop zone */}
        <div
          className={`mb-[2px] break-inside-avoid flex items-center justify-center cursor-pointer transition-colors ${
            isDragging ? "bg-secondary gallery-border" : "gallery-border-dashed"
          }`}
          style={{ aspectRatio: "4/3" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <div className="text-muted-foreground/40 text-[20px] mb-1">+</div>
            <div className="font-mono text-[10px] text-muted-foreground/40">
              {isDragging ? "Drop to upload" : "Drop files here"}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.dwg,.skp,.3dm,.rvt"
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>
    </div>
  );
};

export default AssetGallery;
