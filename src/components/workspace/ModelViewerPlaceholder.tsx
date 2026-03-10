import { useState, useCallback, useRef, useEffect } from "react";
import { parseIfcFile, type IfcEntity, type IfcProjectSummary } from "@/lib/ifcUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RoomEditor3D from "./RoomEditor3D";

interface Point2D {
  x: number;
  y: number;
}

interface Props {
  projectId?: string;
}

type Mode = "empty" | "sketch" | "viewing-3d" | "viewing-ifc";

const SNAP_RADIUS = 8; // px — snap to grid dots within this radius
const CLOSE_RADIUS = 12; // px — snap to first point to close a wall loop
const POINT_HIT_RADIUS = 10; // px — click within this to select a point

type EditMode = "draw" | "select" | "door" | "window";

interface SelectedPoint {
  pathIndex: number; // index into wallPaths
  pointIndex: number;
}

export interface Opening {
  id: string;
  type: "door" | "window";
  wallPathIndex: number;  // index into wallPaths
  segmentIndex: number;   // which segment (edge) of that path
  position: number;       // 0–1 along the segment
  width: number;          // meters
  height: number;         // meters
  sillHeight?: number;    // meters from floor (windows only)
}

const ModelViewerPlaceholder = ({ projectId }: Props) => {
  const [mode, setMode] = useState<Mode>("empty");
  const [summary, setSummary] = useState<IfcProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<IfcEntity | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [sketchPreview, setSketchPreview] = useState<string | null>(null);
  const [roomPaths, setRoomPaths] = useState<{ points: Point2D[] }[]>([]);
  const [uploadedSketch, setUploadedSketch] = useState<string | null>(null);
  const [gridScale, setGridScale] = useState<"1ft" | "0.5m" | "1m">("1ft");

  // Wall drawing state
  const [wallPaths, setWallPaths] = useState<Point2D[][]>([]); // completed paths
  const [activePath, setActivePath] = useState<Point2D[]>([]); // current path being drawn
  const [mousePos, setMousePos] = useState<Point2D | null>(null); // cursor preview
  const svgRef = useRef<SVGSVGElement>(null);

  // Openings & ceiling
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [ceilingHeight, setCeilingHeight] = useState(2.8); // meters

  // Point editing state
  const [editMode, setEditMode] = useState<EditMode>("draw");
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<SelectedPoint | null>(null);

  // Opening editing state
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);
  const openingIdCounter = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── IFC Upload ──────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "ifc") {
      toast.error("Please upload an IFC file (.ifc)");
      return;
    }

    setLoading(true);
    try {
      const content = await file.text();
      const parsed = parseIfcFile(content);
      setSummary(parsed);
      setExpandedIds(new Set());
      setSelectedEntity(null);
      setMode("viewing-ifc");

      if (projectId) {
        const storagePath = `${projectId}/bim/${file.name}`;
        const { error } = await supabase.storage
          .from("project-assets")
          .upload(storagePath, file, { upsert: true });
        if (error) {
          console.warn("Failed to upload IFC to storage:", error.message);
        } else {
          toast.success(`${file.name} uploaded and parsed`);
        }
      } else {
        toast.success(`Parsed ${parsed.totalEntities} entities from ${file.name}`);
      }
    } catch (err) {
      console.error("IFC parse error:", err);
      toast.error("Failed to parse IFC file");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ─── Drop zone ───────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith(".ifc")) {
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, []);

  // ─── Grid snapping helper ──────────────────────────────
  const GRID_PX_MAP: Record<string, number> = { "1m": 40, "0.5m": 20, "1ft": 24 };
  const gridPx = GRID_PX_MAP[gridScale] || 24;

  const snapToGrid = useCallback((x: number, y: number): Point2D => {
    const snappedX = Math.round(x / gridPx) * gridPx;
    const snappedY = Math.round(y / gridPx) * gridPx;
    const dist = Math.sqrt((x - snappedX) ** 2 + (y - snappedY) ** 2);
    if (dist < SNAP_RADIUS) return { x: snappedX, y: snappedY };
    return { x, y };
  }, [gridPx]);

  // ─── Wall drawing handlers ─────────────────────────────
  const getSvgPoint = useCallback((e: React.MouseEvent): Point2D | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ─── Point hit-testing helper ──────────────────────────
  const findPointNear = useCallback((pos: Point2D): SelectedPoint | null => {
    let best: SelectedPoint | null = null;
    let bestDist = POINT_HIT_RADIUS;
    for (let pi = 0; pi < wallPaths.length; pi++) {
      for (let i = 0; i < wallPaths[pi].length; i++) {
        const p = wallPaths[pi][i];
        const dist = Math.sqrt((pos.x - p.x) ** 2 + (pos.y - p.y) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          best = { pathIndex: pi, pointIndex: i };
        }
      }
    }
    return best;
  }, [wallPaths]);

  // ─── Segment hit-testing (for door/window placement) ────
  const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };
  const metersPerPx = (GRID_METERS[gridScale] || 0.3048) / gridPx;

  const findSegmentNear = useCallback((pos: Point2D): { pathIndex: number; segmentIndex: number; position: number } | null => {
    const MAX_DIST = 8; // px distance threshold to wall segment
    let best: { pathIndex: number; segmentIndex: number; position: number; dist: number } | null = null;
    for (let pi = 0; pi < wallPaths.length; pi++) {
      const path = wallPaths[pi];
      for (let si = 0; si < path.length - 1; si++) {
        const a = path[si];
        const b = path[si + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue;
        // Project pos onto segment
        let t = ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / lenSq;
        t = Math.max(0.05, Math.min(0.95, t)); // clamp with margin
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
        if (dist < MAX_DIST && (!best || dist < best.dist)) {
          best = { pathIndex: pi, segmentIndex: si, position: t, dist };
        }
      }
    }
    return best ? { pathIndex: best.pathIndex, segmentIndex: best.segmentIndex, position: best.position } : null;
  }, [wallPaths]);

  // ─── Opening SVG geometry helper ──────────────────────────
  const getOpeningSvgCoords = useCallback((opening: Opening) => {
    const path = wallPaths[opening.wallPathIndex];
    if (!path) return null;
    const a = path[opening.segmentIndex];
    const b = path[opening.segmentIndex + 1];
    if (!a || !b) return null;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 1) return null;

    // Unit direction and perpendicular
    const ux = dx / segLen;
    const uy = dy / segLen;
    const nx = -uy; // perpendicular
    const ny = ux;

    // Opening center along segment
    const cx = a.x + opening.position * dx;
    const cy = a.y + opening.position * dy;

    // Opening half-width in pixels
    const halfW = (opening.width / metersPerPx) / 2;

    return {
      x1: cx - halfW * ux,
      y1: cy - halfW * uy,
      x2: cx + halfW * ux,
      y2: cy + halfW * uy,
      cx, cy,
      nx, ny, ux, uy,
      halfW,
    };
  }, [wallPaths, metersPerPx]);

  // ─── Canvas handlers (mode-aware) ───────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const raw = getSvgPoint(e);
    if (!raw) return;

    if (editMode === "select") {
      // In select mode: click to select/deselect points or openings
      if (isDragging) return;
      // Check openings first
      const hitOpening = openings.find((op) => {
        const coords = getOpeningSvgCoords(op);
        if (!coords) return false;
        const dist = Math.sqrt((raw.x - coords.cx) ** 2 + (raw.y - coords.cy) ** 2);
        return dist < coords.halfW + 6;
      });
      if (hitOpening) {
        setSelectedOpeningId(hitOpening.id);
        setSelectedPoint(null);
        return;
      }
      const hit = findPointNear(raw);
      setSelectedPoint(hit);
      setSelectedOpeningId(null);
      return;
    }

    if (editMode === "door" || editMode === "window") {
      // Place a door or window on the nearest wall segment
      const seg = findSegmentNear(raw);
      if (!seg) {
        toast.error("Click on a wall segment to place");
        return;
      }
      const id = `opening-${++openingIdCounter.current}`;
      const isDoor = editMode === "door";
      const newOpening: Opening = {
        id,
        type: isDoor ? "door" : "window",
        wallPathIndex: seg.pathIndex,
        segmentIndex: seg.segmentIndex,
        position: seg.position,
        width: isDoor ? 0.9 : 1.2,   // meters
        height: isDoor ? 2.1 : 1.2,  // meters
        sillHeight: isDoor ? undefined : 0.9,
      };
      setOpenings((prev) => [...prev, newOpening]);
      return;
    }

    // Draw mode
    const pt = snapToGrid(raw.x, raw.y);

    // Check if closing the loop (clicking near first point of active path)
    if (activePath.length >= 3) {
      const first = activePath[0];
      const dist = Math.sqrt((pt.x - first.x) ** 2 + (pt.y - first.y) ** 2);
      if (dist < CLOSE_RADIUS) {
        setWallPaths((prev) => [...prev, [...activePath, { ...first }]]);
        setActivePath([]);
        return;
      }
    }

    setActivePath((prev) => [...prev, pt]);
  }, [getSvgPoint, snapToGrid, activePath, editMode, isDragging, findPointNear, findSegmentNear, openings, getOpeningSvgCoords]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const raw = getSvgPoint(e);
    if (!raw) return;

    if (editMode === "select") {
      if (isDragging && selectedPoint) {
        // Drag selected point to new position
        const snapped = snapToGrid(raw.x, raw.y);
        setWallPaths((prev) => {
          const updated = prev.map((path) => [...path]);
          updated[selectedPoint.pathIndex][selectedPoint.pointIndex] = snapped;
          return updated;
        });
      } else {
        // Hover detection
        const hit = findPointNear(raw);
        setHoveredPoint(hit);
      }
      return;
    }

    // Draw mode
    setMousePos(snapToGrid(raw.x, raw.y));
  }, [getSvgPoint, snapToGrid, editMode, isDragging, selectedPoint, findPointNear]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (editMode !== "select") return;
    const raw = getSvgPoint(e);
    if (!raw) return;
    const hit = findPointNear(raw);
    if (hit) {
      setSelectedPoint(hit);
      setIsDragging(true);
      e.preventDefault();
    }
  }, [editMode, getSvgPoint, findPointNear]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isDragging) {
      // Small delay to prevent the click handler from deselecting
      setTimeout(() => setIsDragging(false), 50);
    }
  }, [isDragging]);

  const handleCanvasDoubleClick = useCallback(() => {
    if (editMode === "select") return;
    // Finish current path without closing
    if (activePath.length >= 2) {
      setWallPaths((prev) => [...prev, [...activePath]]);
      setActivePath([]);
    }
  }, [activePath, editMode]);

  // Keyboard: Escape to cancel, Enter to finish path, Delete to remove selected point
  useEffect(() => {
    if (mode !== "sketch") return;
    const handleKey = (e: KeyboardEvent) => {
      // Mode switching shortcuts (only when not typing in input)
      if (e.key === "d" && !e.metaKey && !e.ctrlKey) {
        setEditMode("draw");
        setSelectedPoint(null);
        setSelectedOpeningId(null);
        return;
      }
      if (e.key === "s" && !e.metaKey && !e.ctrlKey && editMode !== "select") {
        setEditMode("select");
        setActivePath([]);
        return;
      }

      if (e.key === "Escape") {
        if (selectedOpeningId) {
          setSelectedOpeningId(null);
        } else if (editMode === "select" && selectedPoint) {
          setSelectedPoint(null);
        } else if (editMode === "door" || editMode === "window") {
          setEditMode("draw");
        } else {
          setActivePath([]);
        }
      } else if (e.key === "Enter" && activePath.length >= 2 && editMode === "draw") {
        setWallPaths((prev) => [...prev, [...activePath]]);
        setActivePath([]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedOpeningId) {
        e.preventDefault();
        setOpenings((prev) => prev.filter((o) => o.id !== selectedOpeningId));
        setSelectedOpeningId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && editMode === "select" && selectedPoint) {
        e.preventDefault();
        setWallPaths((prev) => {
          const updated = prev.map((path) => [...path]);
          const path = updated[selectedPoint.pathIndex];
          if (path.length <= 2) {
            updated.splice(selectedPoint.pathIndex, 1);
          } else {
            path.splice(selectedPoint.pointIndex, 1);
          }
          return updated;
        });
        setSelectedPoint(null);
      } else if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (activePath.length > 0) {
          setActivePath((prev) => prev.slice(0, -1));
        } else if (wallPaths.length > 0) {
          setWallPaths((prev) => prev.slice(0, -1));
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, activePath, wallPaths, editMode, selectedPoint, selectedOpeningId]);

  // ─── 3D Generation (instant, client-side) ───────────────
  const handleGenerate3D = useCallback(() => {
    const allPaths = [...wallPaths];
    if (activePath.length >= 2) {
      allPaths.push([...activePath]);
    }
    if (allPaths.length === 0) {
      toast.error("Draw some walls first");
      return;
    }
    const paths = allPaths.map((pts) => ({ points: pts }));
    setRoomPaths(paths);
    setMode("viewing-3d");
  }, [wallPaths, activePath]);

  // Export GLB via edge function
  const handleExportGlb = useCallback(async () => {
    if (!projectId || roomPaths.length === 0) return;
    toast("Exporting GLB...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-3d-model", {
        body: {
          paths: roomPaths,
          project_id: projectId,
          grid_scale: gridScale,
          wall_height: ceilingHeight,
          wall_thickness: 0.15,
          openings,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Export failed");
      window.open(data.model_url, "_blank");
      toast.success("GLB exported!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GLB export failed");
    }
  }, [projectId, roomPaths, gridScale, ceilingHeight, openings]);

  // ─── IFC tree helpers ───────────────────────────────────
  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetToEmpty = useCallback(() => {
    setMode("empty");
    setSummary(null);
    setSelectedEntity(null);
    setModelUrl(null);
    setSketchPreview(null);
    setUploadedSketch(null);
    setWallPaths([]);
    setActivePath([]);
    setSelectedPoint(null);
    setEditMode("draw");
    setOpenings([]);
    setCeilingHeight(2.8);
    setSelectedOpeningId(null);
  }, []);

  // ═══════════════════════════════════════════════════════
  // MODE: EMPTY (landing)
  // ═══════════════════════════════════════════════════════
  if (mode === "empty") {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="text-center space-y-6 max-w-[380px]">
          <div
            className="w-[200px] h-[200px] mx-auto flex items-center justify-center gallery-border-dashed"
            style={{ background: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)" }}
          >
            {loading ? (
              <span className="font-mono text-[11px] text-muted-foreground animate-pulse">Loading...</span>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-mono text-[12px] text-foreground">3D Model Workspace</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              Sketch a design to generate a 3D model, or upload an IFC file
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Drop .ifc or image files here
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setMode("sketch")}
              className="h-[30px] px-4 gallery-border font-mono text-[11px] text-foreground hover:bg-secondary transition-colors"
            >
              Sketch to 3D
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ifc"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-[30px] px-4 gallery-border font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Upload IFC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MODE: SKETCH (click-to-place wall tool)
  // ═══════════════════════════════════════════════════════
  if (mode === "sketch") {
    const scaleLabel = gridScale === "1m" ? "1 m" : gridScale === "0.5m" ? "0.5 m" : "1 ft";
    const totalWalls = wallPaths.reduce((s, p) => s + Math.max(0, p.length - 1), 0)
      + Math.max(0, activePath.length - 1);

    // Compute wall length for preview (last segment)
    let previewLength = "";
    if (activePath.length > 0 && mousePos) {
      const last = activePath[activePath.length - 1];
      const pxDist = Math.sqrt((mousePos.x - last.x) ** 2 + (mousePos.y - last.y) ** 2);
      const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };
      const metersPerPx = (GRID_METERS[gridScale] || 0.3048) / gridPx;
      const meters = pxDist * metersPerPx;
      previewLength = gridScale === "1ft"
        ? `${(meters / 0.3048).toFixed(1)} ft`
        : `${meters.toFixed(2)} m`;
    }

    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={resetToEmpty}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
            <span className="font-mono text-[12px] font-medium">Floor Plan</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {totalWalls} wall{totalWalls !== 1 ? "s" : ""}
              {openings.length > 0 && ` · ${openings.filter(o => o.type === "door").length}D ${openings.filter(o => o.type === "window").length}W`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Edit mode toggle */}
            <div className="flex items-center gap-0.5">
              {(
                [
                  { mode: "draw" as EditMode, label: "Draw", title: "Draw walls (D)" },
                  { mode: "select" as EditMode, label: "Select", title: "Select & move points (S)" },
                  { mode: "door" as EditMode, label: "Door", title: "Place door on wall" },
                  { mode: "window" as EditMode, label: "Window", title: "Place window on wall" },
                ] as const
              ).map(({ mode: m, label, title }) => (
                <button
                  key={m}
                  onClick={() => {
                    setEditMode(m);
                    if (m !== "select") setSelectedPoint(null);
                    if (m !== "draw") setActivePath([]);
                    setSelectedOpeningId(null);
                  }}
                  className={`h-[24px] px-2 text-[10px] font-mono transition-colors ${
                    editMode === m
                      ? "bg-foreground text-background"
                      : "gallery-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={title}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border mx-1" />
            {/* Grid scale selector */}
            <div className="flex items-center gap-0.5">
              {(["1ft", "0.5m", "1m"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setGridScale(s)}
                  className={`h-[24px] px-2 text-[10px] font-mono transition-colors ${
                    gridScale === s
                      ? "bg-foreground text-background"
                      : "gallery-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "1ft" ? "1 ft" : s === "0.5m" ? "½ m" : "1 m"}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => {
                if (activePath.length > 0) {
                  setActivePath((prev) => prev.slice(0, -1));
                } else if (wallPaths.length > 0) {
                  setWallPaths((prev) => prev.slice(0, -1));
                }
              }}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Undo
            </button>
            <button
              onClick={() => { setWallPaths([]); setActivePath([]); }}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={handleGenerate3D}
              className="h-[24px] px-3 bg-foreground text-background text-[10px] font-mono hover:opacity-90 transition-opacity"
            >
              View 3D
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex">
            {/* Y-axis ruler */}
            <div className="w-[32px] shrink-0 relative overflow-hidden" style={{ borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--muted))" }}>
              {Array.from({ length: Math.ceil(800 / gridPx) }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-1 font-mono text-[8px] text-muted-foreground/60"
                  style={{ top: `${i * gridPx - 4}px` }}
                >
                  {i > 0 && i % 5 === 0 ? `${i}` : ""}
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              {/* X-axis ruler */}
              <div className="h-[24px] shrink-0 relative overflow-hidden" style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted))" }}>
                <div className="absolute left-0 top-[6px] flex items-center gap-1 px-2">
                  <span className="font-mono text-[8px] text-muted-foreground/80">Grid: {scaleLabel}/dot</span>
                </div>
                {Array.from({ length: Math.ceil(1200 / gridPx) }, (_, i) => (
                  <div
                    key={i}
                    className="absolute bottom-1 font-mono text-[8px] text-muted-foreground/60"
                    style={{ left: `${i * gridPx - 3}px` }}
                  >
                    {i > 0 && i % 5 === 0 ? `${i}` : ""}
                  </div>
                ))}
              </div>
              {/* Drawing area with dot grid + SVG overlay */}
              <div
                className={`flex-1 relative overflow-hidden ${
                  editMode === "select"
                    ? hoveredPoint ? "cursor-grab" : isDragging ? "cursor-grabbing" : "cursor-default"
                    : editMode === "door" || editMode === "window"
                    ? "cursor-copy"
                    : "cursor-crosshair"
                }`}
                style={{
                  backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
                  backgroundSize: `${gridPx}px ${gridPx}px`,
                  backgroundPosition: "0 0",
                }}
              >
                <svg
                  ref={svgRef}
                  className="absolute inset-0 w-full h-full"
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                  onDoubleClick={handleCanvasDoubleClick}
                  onMouseLeave={() => { setMousePos(null); setHoveredPoint(null); if (isDragging) setIsDragging(false); }}
                >
                  {/* Completed wall paths */}
                  {wallPaths.map((path, pi) => (
                    <g key={`path-${pi}`}>
                      <polyline
                        points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {path.map((p, i) => {
                        const isSelected = selectedPoint?.pathIndex === pi && selectedPoint?.pointIndex === i;
                        const isHovered = hoveredPoint?.pathIndex === pi && hoveredPoint?.pointIndex === i;
                        return (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={isSelected ? "7" : isHovered ? "6" : "4"}
                            fill={isSelected ? "#f97316" : isHovered ? "#fb923c" : "#1e293b"}
                            stroke={isSelected ? "#fff" : isHovered ? "#fff" : "none"}
                            strokeWidth={isSelected || isHovered ? "2" : "0"}
                          />
                        );
                      })}
                    </g>
                  ))}

                  {/* Active path being drawn */}
                  {activePath.length > 0 && (
                    <g>
                      <polyline
                        points={activePath.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {activePath.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={i === 0 && activePath.length >= 3 ? "6" : "4"}
                          fill={i === 0 && activePath.length >= 3 ? "#2563eb" : "#2563eb"}
                          stroke={i === 0 && activePath.length >= 3 ? "#fff" : "none"}
                          strokeWidth="2"
                        />
                      ))}

                      {/* Preview line to cursor */}
                      {mousePos && (
                        <>
                          <line
                            x1={activePath[activePath.length - 1].x}
                            y1={activePath[activePath.length - 1].y}
                            x2={mousePos.x}
                            y2={mousePos.y}
                            stroke="#2563eb"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                            opacity="0.6"
                          />
                          <circle cx={mousePos.x} cy={mousePos.y} r="3" fill="#2563eb" opacity="0.5" />
                          {/* Length label */}
                          {previewLength && (
                            <text
                              x={(activePath[activePath.length - 1].x + mousePos.x) / 2}
                              y={(activePath[activePath.length - 1].y + mousePos.y) / 2 - 8}
                              textAnchor="middle"
                              className="fill-blue-600"
                              style={{ fontSize: "10px", fontFamily: "monospace" }}
                            >
                              {previewLength}
                            </text>
                          )}
                        </>
                      )}
                    </g>
                  )}

                  {/* Openings (doors & windows) */}
                  {openings.map((op) => {
                    const coords = getOpeningSvgCoords(op);
                    if (!coords) return null;
                    const { x1, y1, x2, y2, cx, cy, nx, ny, halfW } = coords;
                    const isSelected = selectedOpeningId === op.id;
                    const isHovered = hoveredOpeningId === op.id;
                    const highlight = isSelected || isHovered;
                    const color = op.type === "door" ? "#b45309" : "#0369a1";
                    const dimLabel = `${op.width.toFixed(1)}m × ${op.height.toFixed(1)}m`;

                    if (op.type === "door") {
                      // Door: gap in wall + swing arc
                      const arcRadius = halfW * 0.9;
                      return (
                        <g key={op.id}
                          onMouseEnter={() => setHoveredOpeningId(op.id)}
                          onMouseLeave={() => setHoveredOpeningId(null)}
                        >
                          {/* White gap to "cut" the wall */}
                          <line x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke="white" strokeWidth="7" />
                          {/* Door frame lines */}
                          <line x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={color} strokeWidth={highlight ? "2.5" : "1.5"}
                            strokeDasharray="none" opacity={highlight ? 1 : 0.8} />
                          {/* Swing arc (quarter circle from hinge point) */}
                          <path
                            d={`M ${x2} ${y2} A ${arcRadius} ${arcRadius} 0 0 1 ${
                              x1 + nx * arcRadius
                            } ${y1 + ny * arcRadius}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="1"
                            strokeDasharray="3 2"
                            opacity={0.6}
                          />
                          {/* Selection ring */}
                          {highlight && (
                            <circle cx={cx} cy={cy} r={halfW + 4}
                              fill="none" stroke={color} strokeWidth="1.5"
                              strokeDasharray="4 2" opacity={0.5} />
                          )}
                          {/* Dimension label on hover */}
                          {(isHovered || isSelected) && (
                            <text x={cx} y={cy - halfW - 6}
                              textAnchor="middle" fill={color}
                              style={{ fontSize: "9px", fontFamily: "monospace" }}>
                              {dimLabel}
                            </text>
                          )}
                        </g>
                      );
                    } else {
                      // Window: gap in wall + double parallel lines
                      const offset = 3;
                      return (
                        <g key={op.id}
                          onMouseEnter={() => setHoveredOpeningId(op.id)}
                          onMouseLeave={() => setHoveredOpeningId(null)}
                        >
                          {/* White gap */}
                          <line x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke="white" strokeWidth="7" />
                          {/* Outer line */}
                          <line
                            x1={x1 + nx * offset} y1={y1 + ny * offset}
                            x2={x2 + nx * offset} y2={y2 + ny * offset}
                            stroke={color} strokeWidth={highlight ? "2" : "1.5"} opacity={highlight ? 1 : 0.8}
                          />
                          {/* Inner line */}
                          <line
                            x1={x1 - nx * offset} y1={y1 - ny * offset}
                            x2={x2 - nx * offset} y2={y2 - ny * offset}
                            stroke={color} strokeWidth={highlight ? "2" : "1.5"} opacity={highlight ? 1 : 0.8}
                          />
                          {/* Cross lines connecting the two parallel lines at endpoints */}
                          <line
                            x1={x1 + nx * offset} y1={y1 + ny * offset}
                            x2={x1 - nx * offset} y2={y1 - ny * offset}
                            stroke={color} strokeWidth="1" opacity={0.6}
                          />
                          <line
                            x1={x2 + nx * offset} y1={y2 + ny * offset}
                            x2={x2 - nx * offset} y2={y2 - ny * offset}
                            stroke={color} strokeWidth="1" opacity={0.6}
                          />
                          {/* Selection ring */}
                          {highlight && (
                            <circle cx={cx} cy={cy} r={halfW + 4}
                              fill="none" stroke={color} strokeWidth="1.5"
                              strokeDasharray="4 2" opacity={0.5} />
                          )}
                          {/* Dimension label */}
                          {(isHovered || isSelected) && (
                            <text x={cx} y={cy - halfW - 6}
                              textAnchor="middle" fill={color}
                              style={{ fontSize: "9px", fontFamily: "monospace" }}>
                              {dimLabel}
                            </text>
                          )}
                        </g>
                      );
                    }
                  })}
                </svg>

                {/* Scale reference bar */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1 pointer-events-none">
                  <div className="flex items-end gap-0">
                    <div className="w-px h-[8px]" style={{ background: "hsl(var(--muted-foreground))" }} />
                    <div className="h-px" style={{ width: `${gridPx * 5}px`, background: "hsl(var(--muted-foreground))" }} />
                    <div className="w-px h-[8px]" style={{ background: "hsl(var(--muted-foreground))" }} />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground ml-1">
                    {gridScale === "1ft" ? "5 ft" : gridScale === "0.5m" ? "2.5 m" : "5 m"}
                  </span>
                </div>

                {/* Help text */}
                {editMode === "draw" && wallPaths.length === 0 && activePath.length === 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="font-mono text-[10px] text-muted-foreground bg-background/80 px-2 py-1">
                      Click to place wall points — double-click or Enter to finish — click near start to close loop
                    </span>
                  </div>
                )}
                {editMode === "select" && wallPaths.length > 0 && !selectedPoint && !selectedOpeningId && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="font-mono text-[10px] text-muted-foreground bg-background/80 px-2 py-1">
                      Click a point or opening to select — drag to move — Delete to remove
                    </span>
                  </div>
                )}
                {(editMode === "door" || editMode === "window") && wallPaths.length > 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="font-mono text-[10px] text-muted-foreground bg-background/80 px-2 py-1">
                      Click on a wall to place a {editMode} — Esc to cancel
                    </span>
                  </div>
                )}
                {(editMode === "door" || editMode === "window") && wallPaths.length === 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="font-mono text-[10px] text-muted-foreground bg-background/80 px-2 py-1">
                      Draw walls first, then place {editMode}s
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MODE: VIEWING-3D (interactive room editor)
  // ═══════════════════════════════════════════════════════
  if (mode === "viewing-3d" && roomPaths.length > 0) {
    return (
      <RoomEditor3D
        paths={roomPaths}
        gridScale={gridScale}
        wallHeight={ceilingHeight}
        wallThickness={0.15}
        openings={openings}
        onBack={() => setMode("sketch")}
        onExportGlb={handleExportGlb}
      />
    );
  }

  // ═══════════════════════════════════════════════════════
  // MODE: VIEWING-IFC (existing IFC tree view)
  // ═══════════════════════════════════════════════════════
  if (mode === "viewing-ifc" && summary) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="font-mono text-[12px] font-medium">{summary.projectName}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{summary.schema}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {summary.totalEntities} entities
            </span>
            <button
              onClick={resetToEmpty}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Entity tree */}
          <div className="w-[280px] shrink-0 overflow-y-auto py-2" style={{ borderRight: "1px solid hsl(var(--border))" }}>
            <p className="px-3 font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Spatial Structure</p>
            {summary.entities.length === 0 ? (
              <p className="px-3 font-mono text-[10px] text-muted-foreground/50">No spatial entities found</p>
            ) : (
              summary.entities.map((entity) => (
                <EntityTreeNode
                  key={entity.id}
                  entity={entity}
                  depth={0}
                  expandedIds={expandedIds}
                  selectedId={selectedEntity?.id ?? null}
                  onToggle={toggleExpand}
                  onSelect={setSelectedEntity}
                />
              ))
            )}

            {/* Entity type summary */}
            <div className="mt-4 px-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Entity Counts</p>
              <div className="space-y-0.5">
                {Object.entries(summary.entityCounts)
                  .filter(([type]) => !type.startsWith("IFCREPRESENTATION") && !type.startsWith("IFCCARTESIAN") && !type.startsWith("IFCDIRECTION"))
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 20)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-muted-foreground truncate">{type.replace("IFC", "")}</span>
                      <span className="font-mono text-[9px] text-foreground ml-2">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Properties panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedEntity ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Selected Element</p>
                  <p className="text-[14px] font-medium">{selectedEntity.name || `#${selectedEntity.id}`}</p>
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{selectedEntity.type}</p>
                </div>

                {selectedEntity.description && selectedEntity.description !== "—" && (
                  <div>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-[12px]">{selectedEntity.description}</p>
                  </div>
                )}

                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Properties</p>
                  <div className="space-y-1">
                    <PropertyRow label="Entity ID" value={`#${selectedEntity.id}`} />
                    <PropertyRow label="IFC Type" value={selectedEntity.type} />
                    {selectedEntity.children.length > 0 && (
                      <PropertyRow label="Children" value={`${selectedEntity.children.length} elements`} />
                    )}
                  </div>
                </div>

                {selectedEntity.attributes.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Raw Attributes</p>
                    <div className="bg-secondary/50 p-2 overflow-x-auto" style={{ border: "1px solid hsl(var(--border))" }}>
                      <pre className="font-mono text-[9px] text-muted-foreground whitespace-pre-wrap break-all">
                        {selectedEntity.attributes.map((a, i) => `[${i}] ${a}`).join("\n")}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30 mx-auto">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Select an element to view properties
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback — shouldn't reach here
  return null;
};

// ─── Sub-components ──────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  IFCPROJECT: "P",
  IFCSITE: "S",
  IFCBUILDING: "B",
  IFCBUILDINGSTOREY: "F",
  IFCSPACE: "R",
  IFCWALL: "W",
  IFCWALLSTANDARDCASE: "W",
  IFCSLAB: "S",
  IFCDOOR: "D",
  IFCWINDOW: "Wi",
  IFCCOLUMN: "C",
  IFCBEAM: "Bm",
  IFCFURNISHINGELEMENT: "Fu",
  IFCROOF: "Rf",
  IFCSTAIR: "St",
};

function EntityTreeNode({
  entity,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  entity: IfcEntity;
  depth: number;
  expandedIds: Set<number>;
  selectedId: number | null;
  onToggle: (id: number) => void;
  onSelect: (e: IfcEntity) => void;
}) {
  const isExpanded = expandedIds.has(entity.id);
  const hasChildren = entity.children.length > 0;
  const isSelected = entity.id === selectedId;
  const icon = ENTITY_ICONS[entity.type] || "E";
  const displayName = entity.name && entity.name !== "—" ? entity.name : entity.type.replace("IFC", "");

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-secondary/50 transition-colors ${isSelected ? "bg-secondary" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(entity)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(entity.id); }}
            className="w-[14px] h-[14px] flex items-center justify-center text-[10px] text-muted-foreground shrink-0"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <span className="w-[18px] h-[14px] flex items-center justify-center bg-secondary text-[8px] font-mono text-muted-foreground shrink-0" style={{ border: "1px solid hsl(var(--border))" }}>
          {icon}
        </span>
        <span className="font-mono text-[10px] truncate">{displayName}</span>
        {hasChildren && (
          <span className="font-mono text-[9px] text-muted-foreground/50 ml-auto shrink-0">{entity.children.length}</span>
        )}
      </div>
      {isExpanded && entity.children.map((child) => (
        <EntityTreeNode
          key={child.id}
          entity={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1" style={{ borderBottom: "1px solid hsl(var(--border) / 0.3)" }}>
      <span className="font-mono text-[10px] text-muted-foreground w-[90px] shrink-0">{label}</span>
      <span className="font-mono text-[10px] text-foreground">{value}</span>
    </div>
  );
}

export default ModelViewerPlaceholder;
