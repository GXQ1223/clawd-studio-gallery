import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── GLB Builder ────────────────────────────────────────────
// Builds a binary glTF (GLB) file from 2D path coordinates by
// extruding each line segment into a 3D wall with configurable
// height and thickness.

interface Point2D {
  x: number;
  y: number;
}

interface WallSegment {
  positions: number[]; // 8 vertices × 3 floats
  normals: number[];
  indices: number[];
}

function buildWallSegment(
  p1: Point2D,
  p2: Point2D,
  height: number,
  thickness: number,
  indexOffset: number
): WallSegment {
  // Direction vector
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { positions: [], normals: [], indices: [] };

  // Perpendicular (for wall thickness)
  const nx = (-dy / len) * (thickness / 2);
  const nz = (dx / len) * (thickness / 2);

  // 8 vertices: 4 bottom + 4 top
  // Map canvas X → 3D X, canvas Y → 3D Z, height → 3D Y
  const positions = [
    // Bottom face (y=0)
    p1.x + nx, 0, p1.y + nz,       // 0: bottom-left-near
    p1.x - nx, 0, p1.y - nz,       // 1: bottom-right-near
    p2.x - nx, 0, p2.y - nz,       // 2: bottom-right-far
    p2.x + nx, 0, p2.y + nz,       // 3: bottom-left-far
    // Top face (y=height)
    p1.x + nx, height, p1.y + nz,  // 4: top-left-near
    p1.x - nx, height, p1.y - nz,  // 5: top-right-near
    p2.x - nx, height, p2.y - nz,  // 6: top-right-far
    p2.x + nx, height, p2.y + nz,  // 7: top-left-far
  ];

  // Simple normals (flat shading — each face gets its own normal)
  // For simplicity, we use averaged normals per vertex
  const normals = [
    nx / (thickness / 2), -1, nz / (thickness / 2),
    -nx / (thickness / 2), -1, -nz / (thickness / 2),
    -nx / (thickness / 2), -1, -nz / (thickness / 2),
    nx / (thickness / 2), -1, nz / (thickness / 2),
    nx / (thickness / 2), 1, nz / (thickness / 2),
    -nx / (thickness / 2), 1, -nz / (thickness / 2),
    -nx / (thickness / 2), 1, -nz / (thickness / 2),
    nx / (thickness / 2), 1, nz / (thickness / 2),
  ];

  const o = indexOffset;
  // 6 faces × 2 triangles each = 12 triangles = 36 indices
  const indices = [
    // Front face (near end)
    o + 0, o + 1, o + 5, o + 0, o + 5, o + 4,
    // Back face (far end)
    o + 2, o + 3, o + 7, o + 2, o + 7, o + 6,
    // Left face
    o + 0, o + 4, o + 7, o + 0, o + 7, o + 3,
    // Right face
    o + 1, o + 2, o + 6, o + 1, o + 6, o + 5,
    // Top face
    o + 4, o + 5, o + 6, o + 4, o + 6, o + 7,
    // Bottom face
    o + 0, o + 3, o + 2, o + 0, o + 2, o + 1,
  ];

  return { positions, normals, indices };
}

function buildFloorPlane(
  minX: number, maxX: number,
  minZ: number, maxZ: number,
  indexOffset: number
): WallSegment {
  const y = -0.01; // Slightly below walls
  const positions = [
    minX, y, minZ,
    maxX, y, minZ,
    maxX, y, maxZ,
    minX, y, maxZ,
  ];
  const normals = [
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ];
  const o = indexOffset;
  const indices = [
    o + 0, o + 1, o + 2,
    o + 0, o + 2, o + 3,
  ];
  return { positions, normals, indices };
}

function buildGlb(
  paths: { points: Point2D[] }[],
  scaleMeters: number,
  wallHeight: number,
  wallThickness: number
): Uint8Array {
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];
  let vertexCount = 0;

  // Track bounds for floor plane
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (const path of paths) {
    const pts = path.points;
    for (let i = 0; i < pts.length - 1; i++) {
      // Convert pixel coordinates to meters using the scale factor
      const p1: Point2D = { x: pts[i].x * scaleMeters, y: pts[i].y * scaleMeters };
      const p2: Point2D = { x: pts[i + 1].x * scaleMeters, y: pts[i + 1].y * scaleMeters };

      const seg = buildWallSegment(p1, p2, wallHeight, wallThickness, vertexCount);
      if (seg.positions.length === 0) continue;

      allPositions.push(...seg.positions);
      allNormals.push(...seg.normals);
      allIndices.push(...seg.indices);
      vertexCount += 8; // 8 vertices per segment

      // Update bounds
      for (let v = 0; v < seg.positions.length; v += 3) {
        minX = Math.min(minX, seg.positions[v]);
        maxX = Math.max(maxX, seg.positions[v]);
        minZ = Math.min(minZ, seg.positions[v + 2]);
        maxZ = Math.max(maxZ, seg.positions[v + 2]);
      }
    }
  }

  // Add floor plane with margin
  if (vertexCount > 0) {
    const margin = 0.5;
    const floor = buildFloorPlane(
      minX - margin, maxX + margin,
      minZ - margin, maxZ + margin,
      vertexCount
    );
    allPositions.push(...floor.positions);
    allNormals.push(...floor.normals);
    allIndices.push(...floor.indices);
    vertexCount += 4;
  }

  if (vertexCount === 0) {
    throw new Error("No geometry generated — draw some lines first");
  }

  // Build binary buffer: positions (float32) + normals (float32) + indices (uint16 or uint32)
  const useUint32 = vertexCount > 65535;
  const posBytes = allPositions.length * 4;
  const normBytes = allNormals.length * 4;
  const idxBytes = allIndices.length * (useUint32 ? 4 : 2);
  // Pad index buffer to 4-byte alignment
  const idxBytesPadded = Math.ceil(idxBytes / 4) * 4;
  const totalBinSize = posBytes + normBytes + idxBytesPadded;

  const binBuffer = new ArrayBuffer(totalBinSize);
  const posView = new Float32Array(binBuffer, 0, allPositions.length);
  const normView = new Float32Array(binBuffer, posBytes, allNormals.length);

  posView.set(allPositions);
  normView.set(allNormals);

  if (useUint32) {
    const idxView = new Uint32Array(binBuffer, posBytes + normBytes, allIndices.length);
    idxView.set(allIndices);
  } else {
    const idxView = new Uint16Array(binBuffer, posBytes + normBytes, allIndices.length);
    idxView.set(allIndices);
  }

  // Compute bounding box for accessor
  let pMin = [Infinity, Infinity, Infinity];
  let pMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < allPositions.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      pMin[j] = Math.min(pMin[j], allPositions[i + j]);
      pMax[j] = Math.max(pMax[j], allPositions[i + j]);
    }
  }

  // Build glTF JSON
  const gltf = {
    asset: { version: "2.0", generator: "clawd-studio-floorplan" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "FloorPlan" }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.85, 0.82, 0.78, 1.0], // Light concrete/plaster color
        metallicFactor: 0.0,
        roughnessFactor: 0.8,
      },
      name: "Wall",
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: allPositions.length / 3,
        type: "VEC3",
        min: pMin,
        max: pMax,
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: allNormals.length / 3,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: useUint32 ? 5125 : 5123, // UNSIGNED_INT or UNSIGNED_SHORT
        count: allIndices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
      { buffer: 0, byteOffset: posBytes + normBytes, byteLength: idxBytes, target: 34963 },
    ],
    buffers: [{ byteLength: totalBinSize }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  // Pad JSON to 4-byte alignment
  const jsonPadded = jsonBytes.length + ((4 - (jsonBytes.length % 4)) % 4);

  // GLB structure: header (12) + JSON chunk header (8) + JSON + BIN chunk header (8) + BIN
  const glbSize = 12 + 8 + jsonPadded + 8 + totalBinSize;
  const glb = new ArrayBuffer(glbSize);
  const view = new DataView(glb);

  // Header
  view.setUint32(0, 0x46546C67, true);  // magic: "glTF"
  view.setUint32(4, 2, true);            // version
  view.setUint32(8, glbSize, true);       // total length

  // JSON chunk
  view.setUint32(12, jsonPadded, true);          // chunk length
  view.setUint32(16, 0x4E4F534A, true);          // chunk type: "JSON"
  const glbBytes = new Uint8Array(glb);
  glbBytes.set(jsonBytes, 20);
  // Pad with spaces (0x20)
  for (let i = jsonBytes.length; i < jsonPadded; i++) {
    glbBytes[20 + i] = 0x20;
  }

  // BIN chunk
  const binOffset = 20 + jsonPadded;
  view.setUint32(binOffset, totalBinSize, true);     // chunk length
  view.setUint32(binOffset + 4, 0x004E4942, true);   // chunk type: "BIN\0"
  glbBytes.set(new Uint8Array(binBuffer), binOffset + 8);

  return new Uint8Array(glb);
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
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { paths, project_id, grid_scale, wall_height, wall_thickness } = await req.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("paths array is required (each with a points array of {x, y})");
    }
    if (!project_id || typeof project_id !== "string") {
      throw new Error("project_id is required");
    }

    // Scale: pixels to meters conversion based on grid setting
    // grid_scale: "1ft" | "0.5m" | "1m" — pixels per grid dot
    const GRID_PX: Record<string, number> = { "1m": 40, "0.5m": 20, "1ft": 24 };
    const GRID_METERS: Record<string, number> = { "1m": 1, "0.5m": 0.5, "1ft": 0.3048 };
    const gridPx = GRID_PX[grid_scale] || 24;
    const gridMeters = GRID_METERS[grid_scale] || 0.3048;
    const scaleMeters = gridMeters / gridPx; // meters per pixel

    const height = wall_height || 2.8;     // meters
    const thickness = wall_thickness || 0.15; // meters

    console.log(`Building 3D from ${paths.length} paths, scale=${grid_scale}, height=${height}m`);

    const glbData = buildGlb(paths, scaleMeters, height, thickness);

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let modelUrl: string;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const filePath = `${project_id}/models/${Date.now()}.glb`;

      const { error: uploadError } = await supabase.storage
        .from("project-assets")
        .upload(filePath, glbData.buffer, {
          contentType: "model/gltf-binary",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("project-assets")
        .getPublicUrl(filePath);
      modelUrl = publicUrlData.publicUrl;
    } else {
      // Return GLB directly as base64 data URL
      const b64 = btoa(String.fromCharCode(...glbData));
      modelUrl = `data:model/gltf-binary;base64,${b64}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        model_url: modelUrl,
        project_id,
        stats: {
          paths: paths.length,
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
