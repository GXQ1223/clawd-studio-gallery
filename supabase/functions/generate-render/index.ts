import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash-exp";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Build an architectural/interior design prompt optimized for photorealistic renders.
 */
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
    `Generate a photorealistic interior design render of the following space:`,
    ``,
    `Style: ${style}`,
    `Description: ${description}`,
    ``,
    `Camera: ${angle}.`,
    ``,
    `Requirements:`,
    `- Photorealistic quality, architectural visualization standard`,
    `- Natural lighting with warm ambient fill and soft shadows`,
    `- High-end materials and finishes appropriate for the ${style} style`,
    `- Realistic furniture proportions and placement`,
    `- Clean composition with professional architectural photography framing`,
    `- 4K quality, sharp details on materials and textures`,
    `- No watermarks, no text overlays, no logos`,
    `- No people or animals in the scene`,
  ].join("\n");
}

/**
 * Call Gemini API to generate a single image.
 */
async function generateImage(prompt: string): Promise<Uint8Array | null> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        temperature: 1.0,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error (${response.status}):`, errorText);
    throw new Error(
      `Gemini API returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();

  // Extract image from response parts
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    console.error("No parts in Gemini response:", JSON.stringify(data));
    return null;
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      // Decode base64 to binary
      const binaryString = atob(part.inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }

  console.error("No image data in Gemini response parts:", JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))));
  return null;
}

/**
 * Upload image bytes to Supabase Storage and return public URL.
 */
async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
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
    if (!GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Set it in Supabase Edge Function secrets.",
      );
    }

    const { style, description, project_id } = await req.json();
    const styleLabel = style || "contemporary";
    const startTime = Date.now();

    // Initialize Supabase client with service role for storage uploads
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate 3 render variations sequentially (Gemini rate limits)
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

        const imageBytes = await generateImage(prompt);

        if (!imageBytes) {
          console.error(`Variation ${i} returned no image data, skipping`);
          continue;
        }

        // Upload to Supabase Storage
        const url = await uploadToStorage(supabase, project_id, imageBytes, i);

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
        // Continue with remaining variations
      }
    }

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders,
        processing_time_ms: processingTime,
        engine: "gemini-2.0-flash (live)",
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
