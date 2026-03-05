import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Curated set of realistic interior render URLs (Unsplash)
const RENDER_SETS: Record<string, string[]> = {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, description, project_id } = await req.json();

    // Simulate processing delay (1-2s)
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

    const styleKey = (style || "default").toLowerCase();
    const renders = RENDER_SETS[styleKey] || RENDER_SETS.default;

    const results = renders.map((url, i) => ({
      id: `render-${Date.now()}-${i}`,
      url,
      label: `${(style || "Contemporary").charAt(0).toUpperCase() + (style || "contemporary").slice(1)} Direction ${String.fromCharCode(65 + i)}`,
      style: style || "contemporary",
      resolution: "2400x1600",
      generated_at: new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        renders: results,
        processing_time_ms: 1200 + Math.floor(Math.random() * 800),
        engine: "intdesign.ai/v2 (mock)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
