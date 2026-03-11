// @ts-nocheck — Deno runtime, not type-checked by project TS config
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = getEnv("CORS_ALLOWED_ORIGIN") || (console.warn("CORS_ALLOWED_ORIGIN not set — defaulting to wildcard. Set this in production."), "*");
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getEnv(key: string): string | undefined {
  const g: any = globalThis;
  if (g.Deno && typeof g.Deno.env?.get === "function") return g.Deno.env.get(key);
  if (g.process && g.process.env) return g.process.env[key];
  return undefined;
}

const GEMINI_API_KEY = getEnv("GEMINI_API_KEY");
const GEMINI_MODEL = getEnv("GEMINI_MODEL") || "gemini-2.0-flash-exp";
const GEMINI_FALLBACK_MODEL = getEnv("GEMINI_FALLBACK_MODEL") || "gemini-1.5-flash";
function geminiEndpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const SUPABASE_URL = getEnv("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY")!;

/** Discipline-specific configuration */
const DISCIPLINE_CONFIG: Record<string, {
  renderType: string;
  defaultDescription: string;
  cameraAngles: string[];
  requirements: string[];
}> = {
  interior: {
    renderType: "interior design render",
    defaultDescription: "A well-designed interior space with cohesive furnishings",
    cameraAngles: [
      "wide-angle perspective from the entry point, showing the full room",
      "three-quarter view from the corner, emphasizing depth and spatial flow",
      "eye-level detail shot highlighting materials, textures, and key furniture pieces",
    ],
    requirements: [
      "Realistic furniture proportions and placement",
      "High-end materials and finishes",
      "Warm ambient lighting with soft shadows",
    ],
  },
  architecture: {
    renderType: "architectural exterior render",
    defaultDescription: "A contemporary building with clean lines and contextual landscaping",
    cameraAngles: [
      "wide street-level perspective showing the full facade and surroundings",
      "three-quarter aerial view emphasizing massing, form, and site context",
      "eye-level pedestrian view highlighting the entrance and material details",
    ],
    requirements: [
      "Accurate building proportions and structural details",
      "Contextual landscaping and urban surroundings",
      "Natural daylight with realistic sky and shadows",
    ],
  },
  landscape: {
    renderType: "landscape design visualization",
    defaultDescription: "A well-designed outdoor space with plantings, hardscape, and water features",
    cameraAngles: [
      "wide panoramic view showing the full landscape layout",
      "elevated perspective emphasizing planting patterns and pathways",
      "eye-level walkthrough view highlighting plantings and hardscape details",
    ],
    requirements: [
      "Realistic vegetation with seasonal planting detail",
      "Accurate hardscape materials and grading",
      "Natural outdoor lighting with atmospheric depth",
    ],
  },
  industrial: {
    renderType: "industrial facility render",
    defaultDescription: "A functional industrial space with efficient layout and proper utilities",
    cameraAngles: [
      "wide-angle view showing the full facility layout and equipment placement",
      "three-quarter elevated view emphasizing workflow and spatial organization",
      "detail shot highlighting key machinery, finishes, and safety features",
    ],
    requirements: [
      "Accurate equipment and infrastructure placement",
      "Functional lighting for workspace safety",
      "Clear visualization of workflow and spatial organization",
    ],
  },
};

function getDiscipline(projectType?: string): string {
  if (!projectType) return "interior";
  const map: Record<string, string> = {
    residential: "interior", commercial: "interior", renovation: "interior", interior: "interior",
    architecture: "architecture", exterior: "architecture",
    landscape: "landscape", garden: "landscape", outdoor: "landscape",
    industrial: "industrial", warehouse: "industrial",
  };
  return map[projectType.toLowerCase()] || "interior";
}

function buildDesignPrompt(
  style: string,
  description: string,
  variationIndex: number,
  projectType?: string,
): string {
  const discipline = getDiscipline(projectType);
  const config = DISCIPLINE_CONFIG[discipline] || DISCIPLINE_CONFIG.interior;
  const angle = config.cameraAngles[variationIndex % config.cameraAngles.length];

  return [
    `Generate a photorealistic ${config.renderType}.`,
    `Style: ${style}.`,
    `${description}`,
    `Camera: ${angle}.`,
    ...config.requirements.map((r) => r + "."),
    `High-end materials and finishes appropriate for the ${style} style.`,
    `Professional architectural photography composition.`,
    `4K quality, sharp material and texture details.`,
    `No watermarks, no text, no logos, no people, no animals.`,
  ].join(" ");
}

/** Per-call timeout in ms (40s — leaves room for 3 parallel calls within 150s limit) */
const PER_CALL_TIMEOUT_MS = 40_000;

/** Call a specific Gemini model to generate a single image */
async function callGeminiModel(prompt: string, model: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(`${geminiEndpoint(model)}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imagenConfig: { aspectRatio: "16:9" },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error (${model}, ${response.status}):`, errorText);
      throw new Error("Image generation failed. Please try again later.");
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.error(`No parts in ${model} response:`, JSON.stringify(data).slice(0, 500));
      return null;
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }

    console.error(`No image data in ${model} response parts`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Generate image with primary model, fall back to secondary on failure */
async function generateImage(prompt: string): Promise<string | null> {
  try {
    return await callGeminiModel(prompt, GEMINI_MODEL);
  } catch (primaryErr) {
    if (GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) {
      console.warn(`Primary model ${GEMINI_MODEL} failed, trying fallback ${GEMINI_FALLBACK_MODEL}`);
      return await callGeminiModel(prompt, GEMINI_FALLBACK_MODEL);
    }
    throw primaryErr;
  }
}

/** Upload base64 image to Supabase Storage */
async function uploadToStorage(
  supabase: any,
  projectId: string,
  b64Data: string,
  index: number,
): Promise<string> {
  const fileName = `${projectId}/render-${Date.now()}-${index}.png`;
  const bucket = "project-assets";

  let binaryString: string;
  try {
    binaryString = atob(b64Data);
  } catch {
    throw new Error("Invalid base64 image data");
  }
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Validate PNG magic bytes (‰PNG\r\n)
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
    throw new Error("Invalid image data: not a valid PNG file");
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, bytes, { contentType: "image/png", upsert: false });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload render: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return urlData.publicUrl;
}

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
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured. Add it to your backend secrets.");
    }

    // Limit request body size (1MB)
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 1_048_576) {
      return new Response(
        JSON.stringify({ error: "Request body too large (max 1MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { style, description, project_id, project_type } = await req.json();

    // Input validation
    const errors: string[] = [];
    if (!project_id || typeof project_id !== "string") {
      errors.push("project_id is required and must be a non-empty string");
    } else if (!/^[a-f0-9-]+$/i.test(project_id)) {
      errors.push("project_id must be a valid UUID format");
    }
    if (description && typeof description === "string" && description.length > 2000) {
      errors.push("description must be under 2,000 characters");
    }
    const VALID_STYLES = [
      "contemporary", "modern", "minimalist", "scandinavian", "industrial",
      "mid-century", "japandi", "bohemian", "traditional", "art deco",
      "farmhouse", "coastal", "rustic", "tropical", "mediterranean",
    ];
    if (style && typeof style === "string" && !VALID_STYLES.includes(style.toLowerCase())) {
      errors.push(`style must be one of: ${VALID_STYLES.join(", ")}`);
    }
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: errors.join("; ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize description: strip control characters and limit to safe text
    const sanitizedDescription = description
      ? String(description).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 2000)
      : undefined;

    const styleLabel = style ? style.toLowerCase() : "contemporary";
    const discipline = getDiscipline(project_type);
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const variationLabels = ["Direction A", "Direction B", "Direction C"];
    const disciplineConfig = DISCIPLINE_CONFIG[discipline] || DISCIPLINE_CONFIG.interior;

    // Generate 3 variations in parallel with per-call timeouts
    const promises = Array.from({ length: 3 }, async (_, i) => {
      try {
        const prompt = buildDesignPrompt(
          styleLabel,
          sanitizedDescription || disciplineConfig.defaultDescription,
          i,
          project_type,
        );

        const b64 = await generateImage(prompt);
        if (!b64) {
          console.error(`Variation ${i} returned no image data, skipping`);
          return null;
        }

        const url = await uploadToStorage(supabase, project_id, b64, i);

        return {
          id: `render-${Date.now()}-${i}`,
          url,
          label: `${styleLabel.charAt(0).toUpperCase() + styleLabel.slice(1)} ${variationLabels[i]}`,
          style: styleLabel,
          resolution: "1024x576",
          generated_at: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`Failed to generate variation ${i}:`, err);
        return null;
      }
    });

    const settled = await Promise.all(promises);
    const renders = settled.filter((r): r is NonNullable<typeof r> => r !== null);

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders,
        processing_time_ms: Date.now() - startTime,
        engine: "gemini-2.0-flash-exp (direct)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-render error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
