import { useState } from "react";
import type { Asset } from "@/data/workspace-data";

interface Props {
  assets: Asset[];
  onDelete?: (id: string) => void;
  onRefine?: (asset: Asset) => void;
}

const PrimaryVersionLayout = ({ assets, onDelete, onRefine }: Props) => {
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const primary = assets[primaryIndex];

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-[12px]">
        No versions yet — chat with your agent to generate one
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3">
      {/* Primary view */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="relative w-full max-w-[640px] group">
          {primary.imageUrl ? (
            <img
              src={primary.imageUrl}
              alt={primary.name}
              className="w-full object-contain"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            />
          ) : (
            <div
              className="w-full aspect-square bg-secondary flex items-center justify-center"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <span className="font-mono text-[11px] text-muted-foreground">No preview</span>
            </div>
          )}

          {/* Hover actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onRefine && (
              <button
                onClick={() => onRefine(primary)}
                className="px-2 py-1 bg-background/90 text-[10px] font-mono gallery-border hover:bg-secondary transition-colors"
              >
                Refine
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(primary.id)}
                className="px-2 py-1 bg-background/90 text-[10px] font-mono text-destructive gallery-border hover:bg-secondary transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">{primary.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              v{assets.length - primaryIndex} of {assets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Version sidebar */}
      {assets.length > 1 && (
        <div
          className="w-[120px] shrink-0 overflow-y-auto py-4 pr-2 space-y-2"
          style={{ borderLeft: "1px solid rgba(0,0,0,0.06)" }}
        >
          <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider px-1">Versions</span>
          {assets.map((asset, i) => (
            <button
              key={asset.id}
              onClick={() => setPrimaryIndex(i)}
              className={`w-full overflow-hidden transition-all ${
                i === primaryIndex ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100"
              }`}
            >
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt={asset.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-secondary" />
              )}
              <span className="block font-mono text-[9px] text-muted-foreground mt-0.5 truncate px-0.5">
                v{assets.length - i}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrimaryVersionLayout;
