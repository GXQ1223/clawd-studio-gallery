import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ──────────────────────────────────────────────────

interface Point2D {
  x: number;
  y: number;
}

interface Opening {
  id: string;
  type: "door" | "window";
  wallPathIndex: number;
  segmentIndex: number;
  position: number; // 0-1 along segment
  width: number;    // meters
  height: number;   // meters
  sillHeight?: number;
}

interface GeometryChunk {
  positions: number[];
  normals: number[];
  indices: number[];
}

// ─── Geometry Builders ──────────────────────────────────────

function buildWallBox(
  p1: Point2D,
  p2: Point2D,
  yBottom: number,
  yTop: number,
  thickness: number,
  indexOffset: number
): GeometryChunk {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001 || yTop - yBottom < 0.001) return { positions: [], normals: [], indices: [] };

  const nx = (-dy / len) * (thickness / 2);
  const nz = (dx / len) * (thickness / 2);
  const h0 = yBottom;
  const h1 = yTop;

  const positions = [
    p1.x + nx, h0, p1.y + nz,
    p1.x - nx, h0, p1.y - nz,
    p2.x - nx, h0, p2.y - nz,
    p2.x + nx, h0, p2.y + nz,
    p1.x + nx, h1, p1.y + nz,
    p1.x - nx, h1, p1.y - nz,
    p2.x - nx, h1, p2.y - nz,
    p2.x + nx, h1, p2.y + nz,
  ];

  const nnx = nx / (thickness / 2);
  const nnz = nz / (thickness / 2);
  const normals = [
    nnx, -1, nnz,  -nnx, -1, -nnz,  -nnx, -1, -nnz,  nnx, -1, nnz,
    nnx, 1, nnz,   -nnx, 1, -nnz,   -nnx, 1, -nnz,   nnx, 1, nnz,
  ];

  const o = indexOffset;
  const indices = [
    o+0,o+1,o+5, o+0,o+5,o+4,
    o+2,o+3,o+7, o+2,o+7,o+6,
    o+0,o+4,o+7, o+0,o+7,o+3,
    o+1,o+2,o+6, o+1,o+6,o+5,
    o+4,o+5,o+6, o+4,o+6,o+7,
    o+0,o+3,o+2, o+0,o+2,o+1,
  ];

  return { positions, normals, indices };
}

function buildPlane(
  minX: number, maxX: number,
  minZ: number, maxZ: number,
  y: number,
  indexOffset: number,
  faceUp: boolean
): GeometryChunk {
  const ny = faceUp ? 1 : -1;
  const positions = [minX,y,minZ, maxX,y,minZ, maxX,y,maxZ, minX,y,maxZ];
  const normals = [0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0];
  const o = indexOffset;
  const indices = faceUp
    ? [o+0,o+1,o+2, o+0,o+2,o+3]
    : [o+0,o+2,o+1, o+0,o+3,o+2];
  return { positions, normals, indices };
}

// ─── GLB Assembly ───────────────────────────────────────────

interface MeshPrimitive {
  positions: number[];
  normals: number[];
  indices: number[];
  materialIndex: number;
}

function assembleGlb(primitives: MeshPrimitive[], materials: Array<{name: string; color: number[]; roughness: number; metalness: number}>): Uint8Array {
  // Each primitive gets its own set of buffer views + accessors
  // All data packed into one binary buffer
  const accessors: unknown[] = [];
  const bufferViews: unknown[] = [];
  const gltfPrimitives: unknown[] = [];

  let totalBinSize = 0;
  const bufferDataParts: ArrayBuffer[] = [];

  for (const prim of primitives) {
    if (prim.positions.length === 0) continue;

    const vertCount = prim.positions.length / 3;
    const useUint32 = vertCount > 65535;

    const posBytes = prim.positions.length * 4;
    const normBytes = prim.normals.length * 4;
    const idxBytes = prim.indices.length * (useUint32 ? 4 : 2);
    const idxBytesPadded = Math.ceil(idxBytes / 4) * 4;
    const partSize = posBytes + normBytes + idxBytesPadded;

    const buf = new ArrayBuffer(partSize);
    new Float32Array(buf, 0, prim.positions.length).set(prim.positions);
    new Float32Array(buf, posBytes, prim.normals.length).set(prim.normals);
    if (useUint32) {
      new Uint32Array(buf, posBytes + normBytes, prim.indices.length).set(prim.indices);
    } else {
      new Uint16Array(buf, posBytes + normBytes, prim.indices.length).set(prim.indices);
    }

    // Compute bounding box
    const pMin = [Infinity, Infinity, Infinity];
    const pMax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < prim.positions.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        pMin[j] = Math.min(pMin[j], prim.positions[i + j]);
        pMax[j] = Math.max(pMax[j], prim.positions[i + j]);
      }
    }

    const bvBase = bufferViews.length;
    const accBase = accessors.length;

    bufferViews.push(
      { buffer: 0, byteOffset: totalBinSize, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: totalBinSize + posBytes, byteLength: normBytes, target: 34962 },
      { buffer: 0, byteOffset: totalBinSize + posBytes + normBytes, byteLength: idxBytes, target: 34963 },
    );

    accessors.push(
      { bufferView: bvBase, componentType: 5126, count: vertCount, type: "VEC3", min: pMin, max: pMax },
      { bufferView: bvBase + 1, componentType: 5126, count: prim.normals.length / 3, type: "VEC3" },
      { bufferView: bvBase + 2, componentType: useUint32 ? 5125 : 5123, count: prim.indices.length, type: "SCALAR" },
    );

    gltfPrimitives.push({
      attributes: { POSITION: accBase, NORMAL: accBase + 1 },
      indices: accBase + 2,
      material: prim.materialIndex,
    });

    bufferDataParts.push(buf);
    totalBinSize += partSize;
  }

  if (gltfPrimitives.length === 0) {
    throw new Error("No geometry generated — draw some walls first");
  }

  // Merge all buffer parts
  const mergedBin = new Uint8Array(totalBinSize);
  let offset = 0;
  for (const part of bufferDataParts) {
    mergedBin.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }

  const gltfMaterials = materials.map((m) => ({
    name: m.name,
    pbrMetallicRoughness: {
      baseColorFactor: [...m.color, 1.0],
      metallicFactor: m.metalness,
      roughnessFactor: m.roughness,
    },
  }));

  const gltf = {
    asset: { version: "2.0", generator: "clawd-studio-floorplan" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "FloorPlan" }],
    meshes: [{ primitives: gltfPrimitives }],
    materials: gltfMaterials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBinSize }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const jsonPadded = jsonBytes.length + ((4 - (jsonBytes.length % 4)) % 4);

  const glbSize = 12 + 8 + jsonPadded + 8 + totalBinSize;
  const glb = new ArrayBuffer(glbSize);
  const view = new DataView(glb);

  view.setUint32(0, 0x46546C67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glbSize, true);

  view.setUint32(12, jsonPadded, true);
  view.setUint32(16, 0x4E4F534A, true);
  const glbBytes = new Uint8Array(glb);
  glbBytes.set(jsonBytes, 20);
  for (let i = jsonBytes.length; i < jsonPadded; i++) {
    glbBytes[20 + i] = 0x20;
  }

  const binOffset = 20 + jsonPadded;
  view.setUint32(binOffset, totalBinSize, true);
  view.setUint32(binOffset + 4, 0x004E4942, true);
  glbBytes.set(mergedBin, binOffset + 8);

  return new Uint8Array(glb);
}

// ─── Main Build Function ────────────────────────────────────

function buildGlb(
  paths: { points: Point2D[] }[],
  scaleMeters: number,
  wallHeight: number,
  wallThickness: number,
  openings: Opening[] = []
): Uint8Array {
  // Material indices: 0=wall, 1=floor, 2=ceiling
  const wallPrim: MeshPrimitive = { positions: [], normals: [], indices: [], materialIndex: 0 };
  const floorPrim: MeshPrimitive = { positions: [], normals: [], indices: [], materialIndex: 1 };
  const ceilingPrim: MeshPrimitive = { positions: [], normals: [], indices: [], materialIndex: 2 };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (let pi = 0; pi < paths.length; pi++) {
    const pts = paths[pi].points;
    for (let si = 0; si < pts.length - 1; si++) {
      const p1: Point2D = { x: pts[si].x * scaleMeters, y: pts[si].y * scaleMeters };
      const p2: Point2D = { x: pts[si + 1].x * scaleMeters, y: pts[si + 1].y * scaleMeters };

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 0.001) continue;

      // Find openings for this segment
      const segOpenings = openings.filter(
        (o) => o.wallPathIndex === pi && o.segmentIndex === si
      ).sort((a, b) => a.position - b.position);

      if (segOpenings.length === 0) {
        // Full wall segment
        const chunk = buildWallBox(p1, p2, 0, wallHeight, wallThickness, wallPrim.positions.length / 3);
        if (chunk.positions.length > 0) {
          wallPrim.positions.push(...chunk.positions);
          wallPrim.normals.push(...chunk.normals);
          wallPrim.indices.push(...chunk.indices);
        }
      } else {
        // Split wall around openings
        const ux = dx / segLen;
        const uy = dy / segLen;
        let prevT = 0; // normalized position along segment

        for (const op of segOpenings) {
          const halfW = op.width / 2;
          const opLeftT = Math.max(0, op.position - halfW / segLen);
          const opRightT = Math.min(1, op.position + halfW / segLen);
          const sillY = op.type === "window" ? (op.sillHeight ?? 0.9) : 0;
          const topY = sillY + op.height;

          // Left solid piece
          if (opLeftT - prevT > 0.001) {
            const lp1 = { x: p1.x + prevT * dx, y: p1.y + prevT * dy };
            const lp2 = { x: p1.x + opLeftT * dx, y: p1.y + opLeftT * dy };
            const chunk = buildWallBox(lp1, lp2, 0, wallHeight, wallThickness, wallPrim.positions.length / 3);
            if (chunk.positions.length > 0) {
              wallPrim.positions.push(...chunk.positions);
              wallPrim.normals.push(...chunk.normals);
              wallPrim.indices.push(...chunk.indices);
            }
          }

          // Sill below window
          if (sillY > 0.01) {
            const sp1 = { x: p1.x + opLeftT * dx, y: p1.y + opLeftT * dy };
            const sp2 = { x: p1.x + opRightT * dx, y: p1.y + opRightT * dy };
            const chunk = buildWallBox(sp1, sp2, 0, sillY, wallThickness, wallPrim.positions.length / 3);
            if (chunk.positions.length > 0) {
              wallPrim.positions.push(...chunk.positions);
              wallPrim.normals.push(...chunk.normals);
              wallPrim.indices.push(...chunk.indices);
            }
          }

          // Lintel above opening
          if (topY < wallHeight - 0.01) {
            const lp1 = { x: p1.x + opLeftT * dx, y: p1.y + opLeftT * dy };
            const lp2 = { x: p1.x + opRightT * dx, y: p1.y + opRightT * dy };
            const chunk = buildWallBox(lp1, lp2, topY, wallHeight, wallThickness, wallPrim.positions.length / 3);
            if (chunk.positions.length > 0) {
              wallPrim.positions.push(...chunk.positions);
              wallPrim.normals.push(...chunk.normals);
              wallPrim.indices.push(...chunk.indices);
            }
          }

          prevT = opRightT;
        }

        // Right solid piece
        if (1 - prevT > 0.001) {
          const rp1 = { x: p1.x + prevT * dx, y: p1.y + prevT * dy };
          const chunk = buildWallBox(rp1, p2, 0, wallHeight, wallThickness, wallPrim.positions.length / 3);
          if (chunk.positions.length > 0) {
            wallPrim.positions.push(...chunk.positions);
            wallPrim.normals.push(...chunk.normals);
            wallPrim.indices.push(...chunk.indices);
          }
        }
      }

      // Update bounds
      for (const p of [p1, p2]) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.y);
        maxZ = Math.max(maxZ, p.y);
      }
    }
  }

  // Floor plane
  if (wallPrim.positions.length > 0) {
    const margin = 0.5;
    const floor = buildPlane(
      minX - margin, maxX + margin,
      minZ - margin, maxZ + margin,
      -0.01, floorPrim.positions.length / 3, true
    );
    floorPrim.positions.push(...floor.positions);
    floorPrim.normals.push(...floor.normals);
    floorPrim.indices.push(...floor.indices);

    // Ceiling plane
    const ceiling = buildPlane(
      minX - margin, maxX + margin,
      minZ - margin, maxZ + margin,
      wallHeight + 0.01, ceilingPrim.positions.length / 3, false
    );
    ceilingPrim.positions.push(...ceiling.positions);
    ceilingPrim.normals.push(...ceiling.normals);
    ceilingPrim.indices.push(...ceiling.indices);
  }

  const materials = [
    { name: "Wall", color: [0.96, 0.96, 0.95], roughness: 0.9, metalness: 0.0 },
    { name: "Floor", color: [0.88, 0.75, 0.55], roughness: 0.65, metalness: 0.0 },
    { name: "Ceiling", color: [0.98, 0.98, 0.97], roughness: 0.9, metalness: 0.0 },
  ];

  const allPrimitives = [wallPrim, floorPrim, ceilingPrim].filter((p) => p.positions.length > 0);
  return assembleGlb(allPrimitives, materials);
}

// ─── Edge Function ─────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { paths, project_id, grid_scale, wall_height, wall_thickness, openings } = await req.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("paths array is required (each with a points array of {x, y})");
    }
    if (!project_id || typeof project_id !== "string") {
      throw new Error("project_id is required");
    }

    const GRID_PX: Record<string, number> = { "1m": 40, "0.5m": 20, "1ft": 24 };
    const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };
    const gridPx = GRID_PX[grid_scale] || 24;
    const gridMeters = GRID_METERS[grid_scale] || 0.3048;
    const scaleMeters = gridMeters / gridPx;

    const height = wall_height || 2.8;
    const thickness = wall_thickness || 0.15;
    const validOpenings: Opening[] = Array.isArray(openings) ? openings : [];

    console.log(`Building 3D: ${paths.length} paths, ${validOpenings.length} openings, h=${height}m`);

    const glbData = buildGlb(paths, scaleMeters, height, thickness, validOpenings);

    // Upload to storage
    const filePath = `${project_id}/models/${Date.now()}.glb`;
    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(filePath, glbData.buffer, {
        contentType: "model/gltf-binary",
        upsert: false,
      });

    let modelUrl: string;
    if (uploadError) {
      console.warn("Storage upload failed, returning base64:", uploadError.message);
      const b64 = btoa(String.fromCharCode(...glbData));
      modelUrl = `data:model/gltf-binary;base64,${b64}`;
    } else {
      const { data: publicUrlData } = supabase.storage
        .from("project-assets")
        .getPublicUrl(filePath);
      modelUrl = publicUrlData.publicUrl;
    }

    return new Response(
      JSON.stringify({
        success: true,
        model_url: modelUrl,
        project_id,
        stats: {
          paths: paths.length,
          openings: validOpenings.length,
          total_points: paths.reduce((s: number, p: { points: Point2D[] }) => s + p.points.length, 0),
          glb_bytes: glbData.byteLength,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("3D model generation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
