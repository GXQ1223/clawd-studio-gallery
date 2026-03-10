import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fallback Unsplash URLs when no API key is configured
const FALLBACK_RENDERS: Record<string, string[]> = {
  modern: [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  ],
  japandi: [
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
    "https://images.unsplash.com/photo-1615529328331-f8917597711f?w=1200&q=80",
  ],
  scandinavian: [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ez637a745?w=1200&q=80",
    "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=1200&q=80",
  ],
  industrial: [
    "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80",
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=80",
    "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
  ],
};

/** Extracted style features from reference images (CLIP-like analysis) */
interface StyleEmbedding {
  colorPalette: string;
  materials: string;
  mood: string;
  lighting: string;
  textures: string;
  furnitureStyle: string;
  spatialQualities: string;
  summary: string;
}

/**
 * Analyze reference images with GPT-4o Vision to extract style embeddings.
 * Acts as a CLIP-like feature extractor for design style transfer.
 */
async function extractStyleEmbedding(
  apiKey: string,
  imageUrls: string[]
): Promise<StyleEmbedding | null> {
  if (!imageUrls.length) return null;

  const imageContent = imageUrls.slice(0, 4).map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a design style analysis expert. Analyze interior design reference images and extract precise style descriptors that can be used to generate new images in the same style.

Return a JSON object with these fields:
- colorPalette: dominant colors and palette description (e.g. "warm neutrals with terracotta accents, cream, sage green, raw umber")
- materials: key materials visible (e.g. "white oak, bouclé fabric, travertine, brushed brass")
- mood: emotional quality (e.g. "serene, sophisticated, lived-in warmth")
- lighting: lighting character (e.g. "diffused natural light, warm ambient, golden hour glow")
- textures: surface textures (e.g. "nubby woven textiles, smooth plaster walls, grain of natural wood")
- furnitureStyle: furniture design language (e.g. "low-profile organic forms, curved lines, minimal ornamentation")
- spatialQualities: spatial feeling (e.g. "open plan with defined zones, generous negative space, intimate scale")
- summary: one-sentence style summary for prompt injection

Return ONLY the JSON object. No markdown.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze these reference images and extract the design style DNA:" },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    console.error("Style extraction failed:", await response.text());
    return null;
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(content) as StyleEmbedding;
  } catch {
    console.error("Failed to parse style embedding:", content);
    return null;
  }
}

/** Build a detailed architectural rendering prompt from the user's brief */
function buildRenderPrompt(
  style: string,
  description: string,
  variation: string,
  hasReferenceImages = false,
  styleEmbedding?: StyleEmbedding | null
): string {
  const styleGuides: Record<string, string> = {
    modern:
      "clean lines, minimalist furniture, neutral tones with bold accents, large windows, polished concrete or hardwood floors",
    japandi:
      "warm wood tones, minimal clutter, wabi-sabi aesthetics, natural materials, low furniture, soft neutral palette",
    scandinavian:
      "white walls, light wood, cozy textiles, functional design, natural light, hygge atmosphere",
    industrial:
      "exposed brick, steel beams, concrete floors, open ceilings, Edison bulbs, raw materials",
    traditional:
      "ornate moldings, rich wood furniture, classic patterns, formal layout, warm color palette",
    bohemian:
      "layered textiles, eclectic mix of patterns, plants, global-inspired decor, warm earthy tones",
    "mid-century":
      "organic curves, tapered legs, bold geometric patterns, statement lighting, walnut and teak",
    contemporary:
      "current design trends, mixed materials, sophisticated palette, statement pieces, layered lighting",
  };

  const styleDesc =
    styleGuides[style.toLowerCase()] || styleGuides.contemporary;

  // If we have a style embedding from reference image analysis, use it for precise style transfer
  if (styleEmbedding) {
    return `Photorealistic interior design rendering, professional architectural visualization. ${description}. Camera angle: ${variation}. STYLE TRANSFER — match this exact aesthetic: ${styleEmbedding.summary}. Color palette: ${styleEmbedding.colorPalette}. Materials: ${styleEmbedding.materials}. Mood: ${styleEmbedding.mood}. Lighting: ${styleEmbedding.lighting}. Textures: ${styleEmbedding.textures}. Furniture: ${styleEmbedding.furnitureStyle}. Spatial qualities: ${styleEmbedding.spatialQualities}. High-end residential photography quality, 8K resolution. Award-winning interior design magazine quality. No text, no watermarks, no people.`;
  }

  const referenceNote = hasReferenceImages
    ? " The client has provided reference images — match their color palette, material vocabulary, and overall mood closely."
    : "";

  return `Photorealistic interior design rendering, professional architectural visualization. ${description}. Style: ${style} — ${styleDesc}. Camera angle: ${variation}.${referenceNote} High-end residential photography quality, 8K resolution, natural lighting with warm ambient glow, shallow depth of field. Award-winning interior design magazine quality. No text, no watermarks, no people.`;
}

/** Camera angle variations for multiple renders */
const CAMERA_VARIATIONS = [
  "wide-angle perspective from the entrance looking in, showing full room layout",
  "eye-level medium shot focusing on the main seating area and focal point",
  "corner perspective showing depth and architectural details, slightly elevated angle",
];

/**
 * Generate spatially-conditioned renders using Replicate ControlNet.
 * Uses the floor plan as a conditioning image so the generated render
 * respects the spatial layout (walls, doors, windows).
 */
async function generateWithControlNet(
  replicateKey: string,
  style: string,
  description: string,
  floorPlanUrl: string,
  hasReferenceImages = false
): Promise<{ url: string; revised_prompt: string }[]> {
  const prompt = buildRenderPrompt(
    style,
    description,
    "wide-angle bird's eye perspective matching the floor plan layout, spatially accurate furniture placement",
    hasReferenceImages
  );

  // Use Replicate's ControlNet SDXL model with scribble/lineart preprocessor
  // The floor plan acts as the structural conditioning image
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateKey}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      version: "4c67958ef55e87e559b3c961be1b1b26e8d213de1d5484f6a3b850189c64f1f8",
      input: {
        image: floorPlanUrl,
        prompt: prompt,
        negative_prompt: "text, watermark, people, blurry, low quality, distorted, cartoon, anime, sketch",
        num_outputs: 2,
        guidance_scale: 7.5,
        controlnet_conditioning_scale: 0.8,
        num_inference_steps: 30,
        scheduler: "K_EULER_ANCESTRAL",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${errText}`);
  }

  const prediction = await response.json();

  // If the prediction is still processing (no "wait" support), poll for it
  let output = prediction.output;
  if (!output && prediction.urls?.get) {
    // Poll until complete (max 120s)
    const pollUrl = prediction.urls.get;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${replicateKey}` },
      });
      const pollData = await pollRes.json();
      if (pollData.status === "succeeded") {
        output = pollData.output;
        break;
      }
      if (pollData.status === "failed" || pollData.status === "canceled") {
        throw new Error(`ControlNet prediction ${pollData.status}: ${pollData.error || "unknown"}`);
      }
    }
  }

  if (!output || !Array.isArray(output) || output.length === 0) {
    throw new Error("ControlNet returned no images");
  }

  return output.map((url: string) => ({
    url,
    revised_prompt: prompt,
  }));
}

/** Generate images using OpenAI DALL-E 3 */
async function generateWithDallE(
  apiKey: string,
  style: string,
  description: string,
  count: number,
  hasReferenceImages = false,
  styleEmbedding?: StyleEmbedding | null
): Promise<{ url: string; revised_prompt: string }[]> {
  const results: { url: string; revised_prompt: string }[] = [];

  // DALL-E 3 only supports 1 image per request, so we run in parallel
  const promises = CAMERA_VARIATIONS.slice(0, count).map(async (variation) => {
    const prompt = buildRenderPrompt(style, description, variation, hasReferenceImages, styleEmbedding);

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "hd",
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DALL-E API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      url: data.data[0].url,
      revised_prompt: data.data[0].revised_prompt || prompt,
    };
  });

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      console.error("Image generation failed:", result.reason);
    }
  }

  return results;
}

/** Download image from URL and upload to Supabase Storage */
async function uploadToStorage(
  supabase: any,
  imageUrl: string,
  projectId: string,
  index: number
): Promise<string> {
  // Download the generated image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const imageBlob = await imageResponse.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();

  const filePath = `${projectId}/renders/${Date.now()}-${index}.png`;

  const { error: uploadError } = await supabase.storage
    .from("project-assets")
    .upload(filePath, arrayBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("project-assets")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, description, project_id, reference_image_urls, floor_plan_url } = await req.json();
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const replicateKey = Deno.env.get("REPLICATE_API_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const startTime = Date.now();
    const styleLabel =
      (style || "Contemporary").charAt(0).toUpperCase() +
      (style || "contemporary").slice(1);

    // If no API keys at all, fall back to mock renders
    if (!openaiKey && !replicateKey) {
      console.warn("OPENAI_API_KEY not set — using fallback mock renders");
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

      const styleKey = (style || "default").toLowerCase();
      const renders = (FALLBACK_RENDERS[styleKey] || FALLBACK_RENDERS.default).map(
        (url, i) => ({
          id: `render-${Date.now()}-${i}`,
          url,
          label: `${styleLabel} Direction ${String.fromCharCode(65 + i)}`,
          style: style || "contemporary",
          resolution: "2400x1600",
          generated_at: new Date().toISOString(),
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          project_id,
          renders,
          processing_time_ms: Date.now() - startTime,
          engine: "intdesign.ai/v2 (mock fallback — set OPENAI_API_KEY for real generation)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasRefImages = Array.isArray(reference_image_urls) && reference_image_urls.length > 0;
    const hasFloorPlan = typeof floor_plan_url === "string" && floor_plan_url.length > 0;

    // Upload helper
    const supabase =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey)
        : null;

    // Step: Extract style embedding from reference images (CLIP-like style transfer)
    let styleEmbedding: StyleEmbedding | null = null;
    if (hasRefImages && openaiKey) {
      console.log(`Extracting style embedding from ${reference_image_urls.length} reference image(s)…`);
      styleEmbedding = await extractStyleEmbedding(openaiKey, reference_image_urls);
      if (styleEmbedding) {
        console.log("Style embedding extracted:", styleEmbedding.summary);
      }
    }

    let generated: { url: string; revised_prompt: string }[];
    let engine: string;

    // Route 1: ControlNet with floor plan conditioning (spatially accurate)
    if (hasFloorPlan && replicateKey) {
      console.log("Using ControlNet with floor plan conditioning");
      generated = await generateWithControlNet(
        replicateKey,
        style || "contemporary",
        description || "beautiful interior space",
        floor_plan_url,
        hasRefImages
      );
      engine = "controlnet-sdxl/floor-plan-conditioned";
    }
    // Route 2: DALL-E 3 (high quality, with optional style transfer)
    else if (openaiKey) {
      generated = await generateWithDallE(
        openaiKey,
        style || "contemporary",
        description || "beautiful interior space",
        3,
        hasRefImages,
        styleEmbedding
      );
      engine = styleEmbedding ? "dall-e-3/hd + style-transfer" : "dall-e-3/hd";
    }
    // Route 3: Replicate SDXL without ControlNet (no floor plan provided)
    else if (replicateKey) {
      // Use standard SDXL via Replicate without conditioning
      const prompt = buildRenderPrompt(
        style || "contemporary",
        description || "beautiful interior space",
        CAMERA_VARIATIONS[0],
        hasRefImages,
        styleEmbedding
      );
      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateKey}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
          input: {
            prompt,
            negative_prompt: "text, watermark, people, blurry, low quality, distorted",
            num_outputs: 3,
            guidance_scale: 7.5,
            num_inference_steps: 30,
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Replicate SDXL error (${res.status}): ${errText}`);
      }
      const prediction = await res.json();
      let output = prediction.output;
      if (!output && prediction.urls?.get) {
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2000));
          const poll = await fetch(prediction.urls.get, {
            headers: { Authorization: `Bearer ${replicateKey}` },
          });
          const pd = await poll.json();
          if (pd.status === "succeeded") { output = pd.output; break; }
          if (pd.status === "failed" || pd.status === "canceled") {
            throw new Error(`SDXL prediction ${pd.status}`);
          }
        }
      }
      generated = (output || []).map((url: string) => ({ url, revised_prompt: prompt }));
      engine = "replicate-sdxl";
    } else {
      throw new Error("No image generation API key configured");
    }

    if (generated.length === 0) {
      throw new Error("All image generation attempts failed");
    }

    const renders = await Promise.all(
      generated.map(async (img, i) => {
        let finalUrl = img.url;

        // Try to upload to storage for persistence
        if (supabase && project_id) {
          try {
            finalUrl = await uploadToStorage(supabase, img.url, project_id, i);
          } catch (err) {
            console.error(`Storage upload failed for render ${i}, using direct URL:`, err);
          }
        }

        const label = hasFloorPlan
          ? `${styleLabel} Floor Plan Render ${String.fromCharCode(65 + i)}`
          : `${styleLabel} Direction ${String.fromCharCode(65 + i)}`;

        return {
          id: `render-${Date.now()}-${i}`,
          url: finalUrl,
          label,
          style: style || "contemporary",
          resolution: engine.includes("dall-e") ? "1792x1024" : "1024x1024",
          generated_at: new Date().toISOString(),
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders,
        processing_time_ms: Date.now() - startTime,
        engine,
        floor_plan_conditioned: hasFloorPlan,
        style_transferred: !!styleEmbedding,
        style_summary: styleEmbedding?.summary || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Render function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
