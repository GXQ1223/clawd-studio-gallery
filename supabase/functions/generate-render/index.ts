import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildDesignPrompt(
  style: string,
  description: string,
  variationIndex: number,
): string {
  const cameraAngles = [
    "wide-angle perspective from the entry point, showing the full room",
    "three-quarter view from the corner, emphasizing depth and spatial flow",
    "eye-level detail shot highlighting materials, textures, and key furniture pieces",
  ];

  const angle = cameraAngles[variationIndex % cameraAngles.length];

  return [
    `A photorealistic interior design render of the following space:`,
    `Style: ${style}`,
    `Description: ${description}`,
    `Camera: ${angle}.`,
    `Photorealistic quality, architectural visualization standard.`,
    `Natural lighting with warm ambient fill and soft shadows.`,
    `High-end materials and finishes appropriate for the ${style} style.`,
    `Realistic furniture proportions and placement.`,
    `Clean composition with professional architectural photography framing.`,
    `Sharp details on materials and textures.`,
    `No watermarks, no text overlays, no logos, no people, no animals.`,
  ].join(" ");
}

async function generateImageDalle3(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    console.error(`DALL-E 3 API error (${response.status}):`, errorText);
    throw new Error(`DALL-E 3 returned ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in DALL-E 3 response");
  }
  return b64;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function uploadToStorage(
  supabase: any,
  projectId: string,
  imageBytes: Uint8Array,
  index: number,
): Promise<string> {
  const fileName = `${projectId}/render-${Date.now()}-${index}.png`;
  const bucket = "project-assets";

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, imageBytes, {
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

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const { style, description, project_id } = await req.json();
    const styleLabel = style || "contemporary";
    const startTime = Date.now();

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

    for (let i = 0; i < 3; i++) {
      try {
        const prompt = buildDesignPrompt(
          styleLabel,
          description || "A well-designed interior space",
          i,
        );

        const b64 = await generateImageDalle3(prompt);
        const imageBytes = base64ToUint8Array(b64);
        const url = await uploadToStorage(supabase, project_id, imageBytes, i);

        renders.push({
          id: `render-${Date.now()}-${i}`,
          url,
          label: `${styleLabel.charAt(0).toUpperCase() + styleLabel.slice(1)} ${variationLabels[i]}`,
          style: styleLabel,
          resolution: "1792x1024",
          generated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Failed to generate variation ${i}:`, err);
      }
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
