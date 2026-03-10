import { useState } from "react";
import { wallAssets, wallZones } from "@/data/wall-data";

const WallView = () => {
  const [pan] = useState({ x: 0, y: 0 });
  const [zoom] = useState(0.45);
  return (
    <div className="h-full relative overflow-hidden" style={{ background: "#fafafa" }}>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: 2400,
          height: 1600,
          position: "absolute",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {wallZones.map((zone) => (
          <div key={zone.label} className="absolute font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/40" style={{ left: zone.x, top: zone.y - 30 }}>
            {zone.label}
          </div>
        ))}
        {wallAssets.map((asset) => (
          <div
            key={asset.id}
            className="absolute cursor-pointer"
            style={{ left: asset.x, top: asset.y, width: asset.width, height: asset.height, transform: `rotate(${asset.rotation || 0}deg)` }}
          >
            <div className="w-full h-full" style={{ background: asset.style === "render" ? "linear-gradient(135deg, #c9c0b4, #a89880)" : asset.style === "plan" ? "#fafafa" : "#f5f3f0", border: "1px solid rgba(0,0,0,0.1)" }} />
            <span className="font-mono text-[10px] text-muted-foreground/60 mt-1 block">{asset.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WallView;
