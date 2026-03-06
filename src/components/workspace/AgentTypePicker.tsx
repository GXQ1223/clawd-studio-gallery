import { useState, useRef, useEffect } from "react";

const deliverableTypes = [
  { value: "perspective", label: "Renders", desc: "Photorealistic images of your space" },
  { value: "sketch", label: "Sketches", desc: "Quick concept visualizations" },
  { value: "plan", label: "Floor Plan", desc: "Spatial layout with dimensions" },
  { value: "elevation", label: "Elevations", desc: "Wall views with finishes" },
  { value: "section", label: "Sections", desc: "Cut-through construction views" },
  { value: "model photo", label: "Model Photos", desc: "Physical model documentation" },
  { value: "3d model", label: "3D Model", desc: "Interactive 3D viewer" },
] as const;

interface Props {
  existingTypes: string[];
  onAdd: (type: string) => void;
}

const AgentTypePicker = ({ existingTypes, onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const available = deliverableTypes.filter((t) => !existingTypes.includes(t.value));

  if (available.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 px-1 text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors rounded-sm"
      >
        <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-dashed border-muted-foreground/30 text-[10px] leading-none">+</span>
        <span>add output</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-[220px] bg-popover border border-border shadow-lg py-1"
          style={{ borderRadius: "2px" }}
        >
          {available.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                onAdd(t.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors"
            >
              <span className="text-[12px] font-medium block">{t.label}</span>
              <span className="text-[10px] text-muted-foreground">{t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentTypePicker;
