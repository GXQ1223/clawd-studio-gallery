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
}

// ─── Grid scale → meters conversion ──────────────────────
const GRID_PX: Record<string, number> = { "1m": 40, "0.5m": 20, "1ft": 24 };
const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };

function buildMeshes(
  paths: PathData[],
  gridScale: string,
  wallHeight: number,
  wallThickness: number
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

      // Wall as a box: length along the segment, height up, thickness perpendicular
      const geo = new THREE.BoxGeometry(len, wallHeight, wallThickness);

      // Position at midpoint, rotate to align with segment direction
      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      const angle = Math.atan2(dz, dx);

      // We'll apply rotation in the mesh component
      geo.userData = { angle };

      meshes.push({
        id: `wall-${pi}-${i}`,
        type: "wall",
        geometry: geo,
        position: [mx, wallHeight / 2, mz],
        label: `Wall ${++wallIdx}`,
      });

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
  color,
  isSelected,
  onSelect,
  opacity = 1,
}: {
  entry: MeshEntry;
  color: string;
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

  // Outline effect for selected
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
          color={color}
          roughness={0.85}
          metalness={0.0}
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

// ─── Color presets ───────────────────────────────────────
const COLOR_PRESETS = [
  { name: "White", hex: "#f5f5f4" },
  { name: "Warm White", hex: "#faf5ef" },
  { name: "Light Gray", hex: "#d4d4d4" },
  { name: "Concrete", hex: "#a3a3a3" },
  { name: "Sage", hex: "#b5c4a1" },
  { name: "Sky", hex: "#a5c8e1" },
  { name: "Blush", hex: "#e8c4c4" },
  { name: "Sand", hex: "#d4c5a9" },
  { name: "Terracotta", hex: "#c67d5b" },
  { name: "Navy", hex: "#2e3a5c" },
  { name: "Forest", hex: "#3d5a3d" },
  { name: "Charcoal", hex: "#404040" },
  { name: "Oak", hex: "#c69c6d" },
  { name: "Walnut", hex: "#5c4033" },
  { name: "Maple", hex: "#e0c08d" },
  { name: "Slate", hex: "#708090" },
];

// ─── Main component ─────────────────────────────────────
export default function RoomEditor3D({
  paths,
  gridScale,
  wallHeight = 2.8,
  wallThickness = 0.15,
  openings = [],
  onBack,
  onExportGlb,
}: Props) {
  // openings will be used in Task 4 for 3D geometry holes
  void openings;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [showCeiling, setShowCeiling] = useState(true);

  const meshes = useMemo(
    () => buildMeshes(paths, gridScale, wallHeight, wallThickness),
    [paths, gridScale, wallHeight, wallThickness]
  );

  const selectedMesh = meshes.find((m) => m.id === selectedId);

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedId) return;
      setColorMap((prev) => ({ ...prev, [selectedId]: color }));
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
              className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              Export GLB
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
              const defaultColor = entry.type === "floor" ? "#e8e5e0" : entry.type === "ceiling" ? "#fafaf9" : "#f5f5f4";
              return (
                <RoomMesh
                  key={entry.id}
                  entry={entry}
                  color={colorMap[entry.id] || defaultColor}
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
          {selectedMesh ? (
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
                  value={colorMap[selectedId!] || (selectedMesh.type === "floor" ? "#e8e5e0" : "#f5f5f4")}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full h-[32px] cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>

              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Presets</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleColorChange(c.hex)}
                      className="w-full aspect-square gallery-border hover:scale-110 transition-transform relative group"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {(colorMap[selectedId!] || "") === c.hex && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-foreground/60" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">All Surfaces</p>
                <div className="space-y-0.5">
                  {meshes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-secondary/50 transition-colors ${
                        m.id === selectedId ? "bg-secondary" : ""
                      }`}
                    >
                      <div
                        className="w-3 h-3 shrink-0 gallery-border"
                        style={{ backgroundColor: colorMap[m.id] || (m.type === "floor" ? "#e8e5e0" : "#f5f5f4") }}
                      />
                      <span className="font-mono text-[10px] truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30 mx-auto">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Click a wall or floor<br />to change its color
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
