import { useState, useMemo, useCallback, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

interface Point2D {
  x: number;
  y: number;
}

interface PathData {
  points: Point2D[];
}

interface MeshEntry {
  id: string;
  type: "wall" | "floor" | "ceiling";
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  label: string;
}

interface Opening {
  id: string;
  type: "door" | "window";
  wallPathIndex: number;
  segmentIndex: number;
  position: number;
  width: number;
  height: number;
  sillHeight?: number;
}

interface Props {
  paths: PathData[];
  gridScale: "1ft" | "0.5m" | "1m";
  wallHeight?: number;
  wallThickness?: number;
  openings?: Opening[];
  onBack?: () => void;
  onExportGlb?: () => void;
  isExporting?: boolean;
}

// ─── Grid scale → meters conversion ──────────────────────
const GRID_PX: Record<string, number> = { "1m": 40, "0.5m": 20, "1ft": 24 };
const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };

function buildMeshes(
  paths: PathData[],
  gridScale: string,
  wallHeight: number,
  wallThickness: number,
  openings: Opening[] = []
): MeshEntry[] {
  const gridPx = GRID_PX[gridScale] || 24;
  const gridMeters = GRID_METERS[gridScale] || 0.3048;
  const scale = gridMeters / gridPx;

  const meshes: MeshEntry[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let wallIdx = 0;

  for (let pi = 0; pi < paths.length; pi++) {
    const pts = paths[pi].points;
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = pts[i].x * scale;
      const z1 = pts[i].y * scale;
      const x2 = pts[i + 1].x * scale;
      const z2 = pts[i + 1].y * scale;

      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.001) continue;

      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      const angle = Math.atan2(dz, dx);
      wallIdx++;

      // Find openings on this wall segment
      const segOpenings = openings.filter(
        (o) => o.wallPathIndex === pi && o.segmentIndex === i
      );

      if (segOpenings.length === 0) {
        // No openings — single box for entire wall
        const geo = new THREE.BoxGeometry(len, wallHeight, wallThickness);
        geo.userData = { angle };
        meshes.push({
          id: `wall-${pi}-${i}`,
          type: "wall",
          geometry: geo,
          position: [mx, wallHeight / 2, mz],
          label: `Wall ${wallIdx}`,
        });
      } else {
        // Split wall around openings
        // Sort openings by position along the wall
        const sorted = [...segOpenings].sort((a, b) => a.position - b.position);

        // Convert opening positions to local X coords (wall goes from -len/2 to +len/2)
        const halfLen = len / 2;
        const pieces: Array<{ localX: number; width: number; yBottom: number; yTop: number; label: string; id: string }> = [];

        // Track filled ranges along X to create left/right pieces
        let prevRight = -halfLen; // left edge of wall in local coords

        for (let oi = 0; oi < sorted.length; oi++) {
          const op = sorted[oi];
          const opCenterX = op.position * len - halfLen; // local X center
          const opHalfW = op.width / 2;
          const opLeft = Math.max(-halfLen, opCenterX - opHalfW);
          const opRight = Math.min(halfLen, opCenterX + opHalfW);

          const sillY = op.type === "window" ? (op.sillHeight ?? 0.9) : 0;
          const topY = sillY + op.height;

          // Left solid piece (from previous right edge to opening left)
          if (opLeft - prevRight > 0.01) {
            const w = opLeft - prevRight;
            pieces.push({
              localX: prevRight + w / 2,
              width: w,
              yBottom: 0,
              yTop: wallHeight,
              label: `Wall ${wallIdx}`,
              id: `wall-${pi}-${i}-solid-${oi}-L`,
            });
          }

          // Sill piece below window (below the opening)
          if (sillY > 0.01) {
            pieces.push({
              localX: opCenterX,
              width: opRight - opLeft,
              yBottom: 0,
              yTop: sillY,
              label: `Wall ${wallIdx} sill`,
              id: `wall-${pi}-${i}-sill-${oi}`,
            });
          }

          // Lintel piece above opening
          if (topY < wallHeight - 0.01) {
            pieces.push({
              localX: opCenterX,
              width: opRight - opLeft,
              yBottom: topY,
              yTop: wallHeight,
              label: `Wall ${wallIdx} lintel`,
              id: `wall-${pi}-${i}-lintel-${oi}`,
            });
          }

          prevRight = opRight;
        }

        // Right solid piece (from last opening right edge to wall end)
        if (halfLen - prevRight > 0.01) {
          const w = halfLen - prevRight;
          pieces.push({
            localX: prevRight + w / 2,
            width: w,
            yBottom: 0,
            yTop: wallHeight,
            label: `Wall ${wallIdx}`,
            id: `wall-${pi}-${i}-solid-R`,
          });
        }

        // Create mesh entries for each piece
        for (const piece of pieces) {
          const h = piece.yTop - piece.yBottom;
          if (h < 0.01 || piece.width < 0.01) continue;
          const geo = new THREE.BoxGeometry(piece.width, h, wallThickness);
          geo.userData = { angle };

          // Convert local X offset back to world position
          // localX=0 corresponds to mx,mz (wall midpoint)
          // local X axis is along (dx/len, dz/len)
          const ux = dx / len;
          const uz = dz / len;
          const worldX = mx + piece.localX * ux;
          const worldZ = mz + piece.localX * uz;

          meshes.push({
            id: piece.id,
            type: "wall",
            geometry: geo,
            position: [worldX, piece.yBottom + h / 2, worldZ],
            label: piece.label,
          });
        }
      }

      // Track bounds
      minX = Math.min(minX, x1, x2);
      maxX = Math.max(maxX, x1, x2);
      minZ = Math.min(minZ, z1, z2);
      maxZ = Math.max(maxZ, z1, z2);
    }
  }

  // Floor plane
  if (meshes.length > 0) {
    const margin = 0.3;
    const floorW = maxX - minX + margin * 2;
    const floorD = maxZ - minZ + margin * 2;
    const floorGeo = new THREE.BoxGeometry(floorW, 0.05, floorD);

    meshes.push({
      id: "floor",
      type: "floor",
      geometry: floorGeo,
      position: [(minX + maxX) / 2, -0.025, (minZ + maxZ) / 2],
      label: "Floor",
    });

    // Ceiling plane
    const ceilingGeo = new THREE.BoxGeometry(floorW, 0.02, floorD);
    meshes.push({
      id: "ceiling",
      type: "ceiling",
      geometry: ceilingGeo,
      position: [(minX + maxX) / 2, wallHeight + 0.01, (minZ + maxZ) / 2],
      label: "Ceiling",
    });
  }

  return meshes;
}

// ─── Individual mesh with click/hover ────────────────────
function RoomMesh({
  entry,
  material,
  isSelected,
  onSelect,
  opacity = 1,
}: {
  entry: MeshEntry;
  material: MaterialState;
  isSelected: boolean;
  onSelect: (id: string) => void;
  opacity?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const angle = entry.geometry.userData?.angle || 0;

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(entry.id);
    },
    [entry.id, onSelect]
  );

  const outlineColor = isSelected ? "#2563eb" : hovered ? "#64748b" : null;

  return (
    <group position={entry.position} rotation={[0, -angle, 0]}>
      <mesh
        ref={meshRef}
        geometry={entry.geometry}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <meshStandardMaterial
          color={material.hex}
          roughness={material.roughness}
          metalness={material.metalness}
          transparent={opacity < 1}
          opacity={opacity}
          side={opacity < 1 ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>
      {outlineColor && (
        <lineSegments>
          <edgesGeometry args={[entry.geometry]} />
          <lineBasicMaterial color={outlineColor} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

// ─── Material presets with PBR properties ────────────────
interface MaterialPreset {
  name: string;
  hex: string;
  roughness: number;
  metalness: number;
  category: MaterialCategory;
}

type MaterialCategory = "Paint" | "Wood" | "Stone" | "Tile" | "Metal";

const MATERIAL_CATEGORIES: MaterialCategory[] = ["Paint", "Wood", "Stone", "Tile", "Metal"];

const MATERIAL_PRESETS: MaterialPreset[] = [
  // Paint
  { name: "White", hex: "#f5f5f4", roughness: 0.9, metalness: 0, category: "Paint" },
  { name: "Warm White", hex: "#faf5ef", roughness: 0.9, metalness: 0, category: "Paint" },
  { name: "Light Gray", hex: "#d4d4d4", roughness: 0.85, metalness: 0, category: "Paint" },
  { name: "Sage", hex: "#b5c4a1", roughness: 0.85, metalness: 0, category: "Paint" },
  { name: "Sky Blue", hex: "#a5c8e1", roughness: 0.85, metalness: 0, category: "Paint" },
  { name: "Blush", hex: "#e8c4c4", roughness: 0.85, metalness: 0, category: "Paint" },
  { name: "Navy", hex: "#2e3a5c", roughness: 0.8, metalness: 0, category: "Paint" },
  { name: "Forest", hex: "#3d5a3d", roughness: 0.8, metalness: 0, category: "Paint" },
  { name: "Charcoal", hex: "#404040", roughness: 0.8, metalness: 0, category: "Paint" },
  { name: "Terracotta", hex: "#c67d5b", roughness: 0.85, metalness: 0, category: "Paint" },
  // Wood
  { name: "Light Oak", hex: "#c69c6d", roughness: 0.7, metalness: 0, category: "Wood" },
  { name: "Maple", hex: "#e0c08d", roughness: 0.65, metalness: 0, category: "Wood" },
  { name: "Pine", hex: "#d4b483", roughness: 0.7, metalness: 0, category: "Wood" },
  { name: "Walnut", hex: "#5c4033", roughness: 0.6, metalness: 0, category: "Wood" },
  { name: "Cherry", hex: "#8b4513", roughness: 0.6, metalness: 0, category: "Wood" },
  { name: "Ebony", hex: "#3b2f2f", roughness: 0.5, metalness: 0.02, category: "Wood" },
  { name: "Bamboo", hex: "#c8b560", roughness: 0.65, metalness: 0, category: "Wood" },
  { name: "Teak", hex: "#9c7a3c", roughness: 0.6, metalness: 0, category: "Wood" },
  // Stone
  { name: "Concrete", hex: "#a3a3a3", roughness: 0.95, metalness: 0, category: "Stone" },
  { name: "Limestone", hex: "#d4c5a9", roughness: 0.9, metalness: 0, category: "Stone" },
  { name: "Slate", hex: "#708090", roughness: 0.8, metalness: 0.05, category: "Stone" },
  { name: "Granite", hex: "#696969", roughness: 0.6, metalness: 0.08, category: "Stone" },
  { name: "Marble White", hex: "#f0ece2", roughness: 0.3, metalness: 0.05, category: "Stone" },
  { name: "Marble Black", hex: "#2d2d2d", roughness: 0.3, metalness: 0.05, category: "Stone" },
  { name: "Sandstone", hex: "#c2a878", roughness: 0.9, metalness: 0, category: "Stone" },
  { name: "Travertine", hex: "#e6d5b8", roughness: 0.7, metalness: 0, category: "Stone" },
  // Tile
  { name: "White Tile", hex: "#f8f8f8", roughness: 0.2, metalness: 0.05, category: "Tile" },
  { name: "Cream Tile", hex: "#f5f0e1", roughness: 0.25, metalness: 0.03, category: "Tile" },
  { name: "Gray Tile", hex: "#b0b0b0", roughness: 0.3, metalness: 0.05, category: "Tile" },
  { name: "Blue Tile", hex: "#4a7c9b", roughness: 0.2, metalness: 0.05, category: "Tile" },
  { name: "Green Tile", hex: "#5a8a6a", roughness: 0.2, metalness: 0.05, category: "Tile" },
  { name: "Black Tile", hex: "#1a1a1a", roughness: 0.15, metalness: 0.08, category: "Tile" },
  { name: "Terracotta Tile", hex: "#b5651d", roughness: 0.6, metalness: 0, category: "Tile" },
  { name: "Mosaic", hex: "#6b8e8e", roughness: 0.3, metalness: 0.05, category: "Tile" },
  // Metal
  { name: "Brushed Steel", hex: "#c0c0c0", roughness: 0.4, metalness: 0.9, category: "Metal" },
  { name: "Polished Chrome", hex: "#e8e8e8", roughness: 0.1, metalness: 0.95, category: "Metal" },
  { name: "Copper", hex: "#b87333", roughness: 0.35, metalness: 0.85, category: "Metal" },
  { name: "Gold", hex: "#d4a843", roughness: 0.3, metalness: 0.9, category: "Metal" },
  { name: "Bronze", hex: "#8b7355", roughness: 0.45, metalness: 0.8, category: "Metal" },
  { name: "Iron", hex: "#48494b", roughness: 0.7, metalness: 0.75, category: "Metal" },
  { name: "Brass", hex: "#c5a846", roughness: 0.35, metalness: 0.85, category: "Metal" },
  { name: "Zinc", hex: "#8a9a9a", roughness: 0.5, metalness: 0.7, category: "Metal" },
];

interface MaterialState {
  hex: string;
  roughness: number;
  metalness: number;
}

const DEFAULT_WALL_MATERIAL: MaterialState = { hex: "#f5f5f4", roughness: 0.9, metalness: 0 };
const DEFAULT_FLOOR_MATERIAL: MaterialState = { hex: "#e0c08d", roughness: 0.65, metalness: 0 }; // Maple wood
const DEFAULT_CEILING_MATERIAL: MaterialState = { hex: "#fafaf9", roughness: 0.9, metalness: 0 };

// ─── Main component ─────────────────────────────────────
export default function RoomEditor3D({
  paths,
  gridScale,
  wallHeight = 2.8,
  wallThickness = 0.15,
  openings = [],
  onBack,
  onExportGlb,
  isExporting = false,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [materialMap, setMaterialMap] = useState<Record<string, MaterialState>>({});
  const [showCeiling, setShowCeiling] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MaterialCategory>("Paint");

  const meshes = useMemo(
    () => buildMeshes(paths, gridScale, wallHeight, wallThickness, openings),
    [paths, gridScale, wallHeight, wallThickness, openings]
  );

  const selectedMesh = meshes.find((m) => m.id === selectedId);

  const getMaterial = useCallback((id: string, type: "wall" | "floor" | "ceiling"): MaterialState => {
    if (materialMap[id]) return materialMap[id];
    if (type === "floor") return DEFAULT_FLOOR_MATERIAL;
    if (type === "ceiling") return DEFAULT_CEILING_MATERIAL;
    return DEFAULT_WALL_MATERIAL;
  }, [materialMap]);

  const handleMaterialChange = useCallback(
    (preset: MaterialPreset) => {
      if (!selectedId) return;
      setMaterialMap((prev) => ({
        ...prev,
        [selectedId]: { hex: preset.hex, roughness: preset.roughness, metalness: preset.metalness },
      }));
    },
    [selectedId]
  );

  const handleColorChange = useCallback(
    (hex: string) => {
      if (!selectedId) return;
      setMaterialMap((prev) => {
        const existing = prev[selectedId] || DEFAULT_WALL_MATERIAL;
        return { ...prev, [selectedId]: { ...existing, hex } };
      });
    },
    [selectedId]
  );

  // Compute scene center for camera target
  const center = useMemo(() => {
    if (meshes.length === 0) return [0, 0, 0] as [number, number, number];
    let cx = 0, cz = 0;
    let count = 0;
    for (const m of meshes) {
      if (m.type === "wall") {
        cx += m.position[0];
        cz += m.position[2];
        count++;
      }
    }
    if (count === 0) return [0, 0, 0] as [number, number, number];
    return [cx / count, wallHeight / 2, cz / count] as [number, number, number];
  }, [meshes, wallHeight]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="font-mono text-[12px] font-medium">3D Room Editor</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {meshes.filter((m) => m.type === "wall").length} walls
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCeiling((v) => !v)}
            className={`h-[24px] px-2 text-[10px] font-mono transition-colors ${
              showCeiling
                ? "bg-foreground text-background"
                : "gallery-border text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle ceiling visibility"
          >
            Ceiling
          </button>
          <span className="font-mono text-[9px] text-muted-foreground">
            H: {wallHeight.toFixed(1)}m
          </span>
          <div className="w-px h-4 bg-border mx-1" />
          {onBack && (
            <button
              onClick={onBack}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Edit Plan
            </button>
          )}
          {onExportGlb && (
            <button
              onClick={onExportGlb}
              disabled={isExporting}
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? "Exporting..." : "Export GLB"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 3D Canvas */}
        <div className="flex-1 min-w-0" style={{ background: "hsl(var(--muted))" }}>
          <Canvas
            camera={{ position: [center[0] + 8, 6, center[2] + 8], fov: 50, near: 0.1, far: 200 }}
            shadows
            onPointerMissed={() => setSelectedId(null)}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
            <directionalLight position={[-5, 10, -5]} intensity={0.3} />
            <Environment preset="apartment" background={false} />

            <OrbitControls
              target={center}
              minDistance={2}
              maxDistance={50}
              maxPolarAngle={Math.PI / 2 - 0.05}
            />

            {/* Ground grid */}
            <gridHelper args={[40, 40, "#cccccc", "#e5e5e5"]} position={[center[0], -0.03, center[2]]} />

            {/* Room meshes */}
            {meshes.map((entry) => {
              if (entry.type === "ceiling" && !showCeiling) return null;
              return (
                <RoomMesh
                  key={entry.id}
                  entry={entry}
                  material={getMaterial(entry.id, entry.type)}
                  isSelected={entry.id === selectedId}
                  onSelect={setSelectedId}
                  opacity={entry.type === "ceiling" ? 0.35 : 1}
                />
              );
            })}
          </Canvas>
        </div>

        {/* Properties panel */}
        <div className="w-[220px] shrink-0 overflow-y-auto p-3" style={{ borderLeft: "1px solid hsl(var(--border))" }}>
          {selectedMesh ? (() => {
            const currentMat = getMaterial(selectedId!, selectedMesh.type);
            const categoryPresets = MATERIAL_PRESETS.filter((p) => p.category === activeCategory);
            return (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Selected</p>
                  <p className="font-mono text-[12px] font-medium">{selectedMesh.label}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{selectedMesh.type}</p>
                </div>

                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Color</p>
                  <input
                    type="color"
                    value={currentMat.hex}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-full h-[32px] cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>

                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Material</p>
                  <div className="flex items-center text-[8px] font-mono text-muted-foreground mb-2">
                    <span>R:{currentMat.roughness.toFixed(2)}</span>
                    <span className="mx-1">·</span>
                    <span>M:{currentMat.metalness.toFixed(2)}</span>
                  </div>
                  {/* Category tabs */}
                  <div className="flex flex-wrap gap-0.5 mb-2">
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`h-[20px] px-1.5 text-[8px] font-mono transition-colors ${
                          activeCategory === cat
                            ? "bg-foreground text-background"
                            : "gallery-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {/* Material swatches */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {categoryPresets.map((preset) => {
                      const isActive = currentMat.hex === preset.hex
                        && currentMat.roughness === preset.roughness
                        && currentMat.metalness === preset.metalness;
                      return (
                        <button
                          key={`${preset.category}-${preset.name}`}
                          onClick={() => handleMaterialChange(preset)}
                          className="w-full aspect-square gallery-border hover:scale-110 transition-transform relative"
                          style={{
                            backgroundColor: preset.hex,
                            backgroundImage: preset.metalness > 0.5
                              ? `linear-gradient(135deg, ${preset.hex} 0%, rgba(255,255,255,0.3) 50%, ${preset.hex} 100%)`
                              : undefined,
                          }}
                          title={`${preset.name}\nR:${preset.roughness} M:${preset.metalness}`}
                        >
                          {isActive && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-foreground/60" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">All Surfaces</p>
                  <div className="space-y-0.5">
                    {meshes.map((m) => {
                      const mat = getMaterial(m.id, m.type);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-secondary/50 transition-colors ${
                            m.id === selectedId ? "bg-secondary" : ""
                          }`}
                        >
                          <div
                            className="w-3 h-3 shrink-0 gallery-border"
                            style={{ backgroundColor: mat.hex }}
                          />
                          <span className="font-mono text-[10px] truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30 mx-auto">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Click a wall or floor<br />to change its material
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
