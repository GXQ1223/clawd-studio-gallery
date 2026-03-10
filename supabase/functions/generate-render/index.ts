import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

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

/** Call Lovable AI Gateway with Gemini image model */
async function generateImage(prompt: string): Promise<string | null> {
  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Gateway error (${response.status}):`, errorText);
    throw new Error(`AI Gateway returned ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const images = data?.choices?.[0]?.message?.images;
  if (!images || images.length === 0) {
    console.error("No images in AI Gateway response");
    return null;
  }

  // Extract base64 data from data:image/png;base64,... URL
  const dataUrl = images[0]?.image_url?.url;
  if (!dataUrl) return null;

  const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  return base64Match ? base64Match[1] : null;
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

  const binaryString = atob(b64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
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

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured.");
    }

    const { style, description, project_id, project_type } = await req.json();
    const styleLabel = style || "contemporary";
    const discipline = getDiscipline(project_type);
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const renders: Array<{
      id: string; url: string; label: string;
      style: string; resolution: string; generated_at: string;
    }> = [];

    const variationLabels = ["Direction A", "Direction B", "Direction C"];
    const disciplineConfig = DISCIPLINE_CONFIG[discipline] || DISCIPLINE_CONFIG.interior;

    // Generate 3 variations sequentially to avoid rate limits
    for (let i = 0; i < 3; i++) {
      try {
        const prompt = buildDesignPrompt(
          styleLabel,
          description || disciplineConfig.defaultDescription,
          i,
          project_type,
        );

        const b64 = await generateImage(prompt);
        if (!b64) {
          console.error(`Variation ${i} returned no image data, skipping`);
          continue;
        }

        const url = await uploadToStorage(supabase, project_id, b64, i);

        renders.push({
          id: `render-${Date.now()}-${i}`,
          url,
          label: `${styleLabel.charAt(0).toUpperCase() + styleLabel.slice(1)} ${variationLabels[i]}`,
          style: styleLabel,
          resolution: "1024x1024",
          generated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Failed to generate variation ${i}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders,
        processing_time_ms: Date.now() - startTime,
        engine: "gemini-2.5-flash-image (lovable-ai)",
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
