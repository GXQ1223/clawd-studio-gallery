import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Discipline-specific configuration for prompt generation */
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

/** Map project_type values to discipline keys */
function getDiscipline(projectType?: string): string {
  if (!projectType) return "interior";
  const map: Record<string, string> = {
    residential: "interior",
    commercial: "interior",
    renovation: "interior",
    interior: "interior",
    architecture: "architecture",
    exterior: "architecture",
    landscape: "landscape",
    garden: "landscape",
    outdoor: "landscape",
    industrial: "industrial",
    warehouse: "industrial",
  };
  return map[projectType.toLowerCase()] || "interior";
}

/**
 * Build a discipline-aware design prompt optimized for photorealistic renders.
 */
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
    `Photorealistic ${config.renderType}.`,
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

/**
 * Call DALL-E 3 API to generate a single image. Returns the image URL.
 */
async function generateImage(prompt: string): Promise<string | null> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`DALL-E API error (${response.status}):`, errorText);
    throw new Error(
      `DALL-E API returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.error("No image data in DALL-E response:", JSON.stringify(data).slice(0, 500));
    return null;
  }

  return b64;
}

/**
 * Upload base64 image to Supabase Storage and return public URL.
 */
async function uploadToStorage(
  supabase: any,
  projectId: string,
  b64Data: string,
  index: number,
): Promise<string> {
  const fileName = `${projectId}/render-${Date.now()}-${index}.png`;
  const bucket = "project-assets";

  // Decode base64 to binary
  const binaryString = atob(b64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, bytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload render: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT verification — reject unauthenticated requests
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

    if (!OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Set it in Supabase Edge Function secrets.",
      );
    }

    const { style, description, project_id, project_type } = await req.json();
    const styleLabel = style || "contemporary";
    const discipline = getDiscipline(project_type);
    const startTime = Date.now();

    // Initialize Supabase client with service role for storage uploads
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const renders: Array<{
      id: string;
      url: string;
      label: string;
      style: string;
      resolution: string;
      generated_at: string;
    }> = [];

    const variationLabels = ["Direction A", "Direction B", "Direction C"];

    // Generate 3 variations — DALL-E 3 supports parallel calls
    const promises = Array.from({ length: 3 }, (_, i) => {
      const disciplineConfig = DISCIPLINE_CONFIG[discipline] || DISCIPLINE_CONFIG.interior;
      const prompt = buildDesignPrompt(
        styleLabel,
        description || disciplineConfig.defaultDescription,
        i,
        project_type,
      );
      return generateImage(prompt)
        .then(async (b64) => {
          if (!b64) return null;
          const url = await uploadToStorage(supabase, project_id, b64, i);
          return {
            id: `render-${Date.now()}-${i}`,
            url,
            label: `${styleLabel.charAt(0).toUpperCase() + styleLabel.slice(1)} ${variationLabels[i]}`,
            style: styleLabel,
            resolution: "1792x1024",
            generated_at: new Date().toISOString(),
          };
        })
        .catch((err) => {
          console.error(`Failed to generate variation ${i}:`, err);
          return null;
        });
    });

    const settled = await Promise.all(promises);
    for (const r of settled) {
      if (r) renders.push(r);
    }

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders,
        processing_time_ms: processingTime,
        engine: "dall-e-3 (live)",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("generate-render error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
