import { useState, useCallback, useRef } from "react";
import type { ProductResult } from "@/lib/designerAgent";

export interface PlacedFurniture {
  id: string;
  productId: string;
  name: string;
  image: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number; // 0.2 - 2.0
}

interface Props {
  renderUrl: string;
  renderLabel: string;
  products: ProductResult[];
  placements: PlacedFurniture[];
  onUpdatePlacements: (placements: PlacedFurniture[]) => void;
  onClose: () => void;
}

const FurnitureCompositor = ({ renderUrl, renderLabel, products, placements, onUpdatePlacements, onClose }: Props) => {
  const [items, setItems] = useState<PlacedFurniture[]>(placements);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const productData = e.dataTransfer.getData("application/json");
    if (!productData || !canvasRef.current) return;

    let product: ProductResult;
    try {
      product = JSON.parse(productData);
    } catch {
      console.error("Invalid product data dropped");
      return;
    }
    if (!product || typeof product.id !== "string" || typeof product.name !== "string") {
      console.error("Malformed product data dropped");
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newItem: PlacedFurniture = {
      id: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      x,
      y,
      scale: 0.5,
    };

    setItems((prev) => [...prev, newItem]);
  }, []);

  const handleItemMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setDraggingId(itemId);
    setSelectedId(itemId);

    const onMouseMove = (me: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((me.clientX - rect.left) / rect.width) * 100;
      const y = ((me.clientY - rect.top) / rect.height) * 100;
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : it));
    };

    const onMouseUp = () => {
      setDraggingId(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleScale = useCallback((itemId: string, delta: number) => {
    setItems((prev) => prev.map((it) =>
      it.id === itemId ? { ...it, scale: Math.max(0.2, Math.min(2, it.scale + delta)) } : it
    ));
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    if (selectedId === itemId) setSelectedId(null);
  }, [selectedId]);

  const handleSave = useCallback(() => {
    onUpdatePlacements(items);
    onClose();
  }, [items, onUpdatePlacements, onClose]);

  const productsWithImages = products.filter((p) => p.image);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background max-w-[1100px] w-full max-h-[90vh] flex flex-col" style={{ border: "1px solid hsl(var(--border))" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium">{renderLabel}</span>
            <span className="font-mono text-[10px] text-muted-foreground">Drag products onto the render</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="h-[28px] px-3 bg-foreground text-background text-[11px] font-mono">
              Save Layout
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Compositing canvas */}
          <div className="flex-1 overflow-auto p-4">
            <div
              ref={canvasRef}
              className="relative inline-block"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCanvasDrop}
              onClick={() => setSelectedId(null)}
            >
              <img src={renderUrl} alt={renderLabel} className="max-w-full max-h-[60vh] object-contain select-none" draggable={false} />

              {/* Placed furniture items */}
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`absolute cursor-move select-none ${selectedId === item.id ? "ring-2 ring-blue-500" : ""} ${draggingId === item.id ? "opacity-80" : ""}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    transform: `translate(-50%, -50%) scale(${item.scale})`,
                    transformOrigin: "center center",
                  }}
                  onMouseDown={(e) => handleItemMouseDown(e, item.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-[80px] h-[80px] object-contain drop-shadow-lg"
                      draggable={false}
                      style={{ mixBlendMode: "multiply" }}
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] bg-secondary/80 flex items-center justify-center" style={{ border: "1px dashed hsl(var(--border))" }}>
                      <span className="font-mono text-[8px] text-muted-foreground text-center px-1">{item.name}</span>
                    </div>
                  )}
                  <p className="text-[8px] font-mono text-center text-white bg-black/50 px-1 mt-0.5 truncate max-w-[80px]">{item.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Product sidebar */}
          <div className="w-[200px] shrink-0 overflow-y-auto p-3 space-y-2" style={{ borderLeft: "1px solid hsl(var(--border))" }}>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Products</p>
            {productsWithImages.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground/50">No products with images available</p>
            )}
            {productsWithImages.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify(p));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="flex items-center gap-2 p-1.5 cursor-grab hover:bg-secondary/50 transition-colors"
                style={{ border: "1px solid hsl(var(--border) / 0.5)" }}
              >
                <img src={p.image} alt={p.name} className="w-[32px] h-[32px] object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium truncate">{p.name}</p>
                  <p className="text-[9px] text-muted-foreground">{p.brand}</p>
                </div>
              </div>
            ))}

            {/* Selected item controls */}
            {selectedId && (
              <div className="pt-3 space-y-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Selected</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleScale(selectedId, -0.1)} className="h-[24px] w-[24px] gallery-border text-[11px] font-mono flex items-center justify-center">−</button>
                  <span className="font-mono text-[10px] text-muted-foreground flex-1 text-center">
                    {Math.round((items.find((i) => i.id === selectedId)?.scale || 1) * 100)}%
                  </span>
                  <button onClick={() => handleScale(selectedId, 0.1)} className="h-[24px] w-[24px] gallery-border text-[11px] font-mono flex items-center justify-center">+</button>
                </div>
                <button onClick={() => handleRemoveItem(selectedId)} className="w-full h-[24px] gallery-border text-[10px] font-mono text-destructive hover:bg-destructive/10">
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FurnitureCompositor;
