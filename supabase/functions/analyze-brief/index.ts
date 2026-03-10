import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") || (console.warn("CORS_ALLOWED_ORIGIN not set — defaulting to wildcard. Set this in production."), "*");
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BriefAnalysis {
  projectType: string;
  style: string | null;
  budget: number | null;
  timeline: string;
  providedAssets: string[];
  requiredDeliverables: string[];
  materials: string[];
  lighting: string | null;
  dimensions: string | null;
  clientPreferences: string[];
}

const SYSTEM_PROMPT = `You are an expert design brief analyst for an AI-powered architectural and interior design studio. Analyze the user's design brief and extract structured information.

Return a JSON object with exactly these fields:
- projectType: one of "residential", "commercial", "renovation", "landscape", "industrial" — infer from context
- style: the design style (e.g. "modern", "japandi", "scandinavian", "industrial", "traditional", "bohemian", "mid-century", "contemporary", "art deco", "farmhouse", "coastal") or null if not specified
- budget: numeric budget in USD (e.g. 50000) or null if not mentioned. Parse amounts like "$50k" as 50000, "50,000" as 50000
- timeline: one of "rush", "standard", "comprehensive" based on urgency cues
- providedAssets: array of asset types the user mentions having (e.g. "floor_plan", "photos", "dimensions", "reference_images", "3d_model", "site_plan")
- requiredDeliverables: array of what the user wants produced (e.g. "renders", "shopping", "presentation", "construction", "floor_plan", "elevations", "sections", "3d_model"). Default to ["renders", "shopping"] if unclear
- materials: array of specific materials mentioned (e.g. "marble", "oak", "brass", "concrete", "linen")
- lighting: lighting preference description or null (e.g. "warm ambient", "natural light focused", "dramatic accent lighting")
- dimensions: room/space dimensions as a string or null (e.g. "20x15 feet", "45 sqm")
- clientPreferences: array of specific preferences or constraints mentioned (e.g. "pet-friendly", "child-safe", "wheelchair accessible", "low maintenance")

Respond with ONLY the JSON object, no markdown fences, no explanation.`;

/** Fallback regex-based analysis when no LLM API key is available */
function analyzeWithRegex(brief: string): BriefAnalysis {
  const lower = brief.toLowerCase();

  // Project type
  let projectType = "residential";
  if (lower.includes("office") || lower.includes("retail") || lower.includes("restaurant") || lower.includes("hotel")) {
    projectType = "commercial";
  } else if (lower.includes("renovation") || lower.includes("remodel")) {
    projectType = "renovation";
  } else if (lower.includes("garden") || lower.includes("landscape") || lower.includes("outdoor") || lower.includes("patio")) {
    projectType = "landscape";
  } else if (lower.includes("factory") || lower.includes("warehouse") || lower.includes("workshop")) {
    projectType = "industrial";
  }

  // Style
  const styleMap: Record<string, string[]> = {
    modern: ["modern", "contemporary", "minimalist", "clean"],
    traditional: ["traditional", "classic", "formal"],
    industrial: ["industrial", "loft", "urban"],
    scandinavian: ["scandinavian", "nordic", "hygge"],
    bohemian: ["bohemian", "boho", "eclectic"],
    "mid-century": ["mid-century", "mid century", "mcm"],
    japandi: ["japandi", "japan", "wabi-sabi"],
    "art deco": ["art deco", "deco", "gatsby"],
    farmhouse: ["farmhouse", "rustic", "country"],
    coastal: ["coastal", "beach", "nautical"],
  };
  let style: string | null = null;
  for (const [s, keywords] of Object.entries(styleMap)) {
    if (keywords.some((kw) => lower.includes(kw))) { style = s; break; }
  }

  // Budget
  let budget: number | null = null;
  const budgetMatch = lower.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(k|thousand|million)?/i);
  if (budgetMatch) {
    let amount = parseFloat(budgetMatch[1].replace(/,/g, ""));
    const multiplier = budgetMatch[2]?.toLowerCase();
    if (multiplier === "k" || multiplier === "thousand") amount *= 1000;
    if (multiplier === "million") amount *= 1000000;
    budget = Math.round(amount);
  }

  // Timeline
  let timeline = "standard";
  if (lower.includes("rush") || lower.includes("urgent") || lower.includes("asap")) timeline = "rush";
  if (lower.includes("comprehensive") || lower.includes("detailed") || lower.includes("thorough")) timeline = "comprehensive";

  // Assets
  const providedAssets: string[] = [];
  if (lower.includes("floor plan") || lower.includes("blueprint") || lower.includes("floorplan")) providedAssets.push("floor_plan");
  if (lower.includes("photo") || lower.includes("image") || lower.includes("picture")) providedAssets.push("photos");
  if (lower.match(/\d+\s*[x×]\s*\d+|\d+'\s*x\s*\d+'|\d+\s*(?:sq\s*(?:ft|m)|square\s*(?:feet|meters?))/)) providedAssets.push("dimensions");
  if (lower.includes("reference") || lower.includes("inspiration")) providedAssets.push("reference_images");
  if (lower.includes("3d model") || lower.includes("sketchup") || lower.includes("revit")) providedAssets.push("3d_model");

  // Deliverables
  const requiredDeliverables: string[] = [];
  if (lower.includes("render") || lower.includes("visual") || lower.includes("perspective")) requiredDeliverables.push("renders");
  if (lower.includes("shopping") || lower.includes("furniture") || lower.includes("product") || lower.includes("sourcing")) requiredDeliverables.push("shopping");
  if (lower.includes("presentation") || lower.includes("deck") || lower.includes("client")) requiredDeliverables.push("presentation");
  if (lower.includes("construction") || lower.includes("detail") || lower.includes("specification")) requiredDeliverables.push("construction");
  if (lower.includes("elevation")) requiredDeliverables.push("elevations");
  if (lower.includes("section")) requiredDeliverables.push("sections");
  if (requiredDeliverables.length === 0) requiredDeliverables.push("renders", "shopping");

  // Materials
  const materialKeywords = ["marble", "granite", "oak", "walnut", "teak", "brass", "copper", "steel", "concrete", "brick", "linen", "velvet", "leather", "wool", "ceramic", "porcelain", "glass", "stone", "wood", "bamboo"];
  const materials = materialKeywords.filter((m) => lower.includes(m));

  // Lighting
  let lighting: string | null = null;
  if (lower.includes("natural light")) lighting = "natural light focused";
  else if (lower.includes("warm")) lighting = "warm ambient";
  else if (lower.includes("dramatic") || lower.includes("accent")) lighting = "dramatic accent lighting";
  else if (lower.includes("bright")) lighting = "bright and airy";

  // Dimensions
  let dimensions: string | null = null;
  const dimMatch = brief.match(/(\d+\s*[x×]\s*\d+\s*(?:feet|ft|m|meters?)?|\d+\s*(?:sq\s*(?:ft|m)|square\s*(?:feet|meters?)))/i);
  if (dimMatch) dimensions = dimMatch[1];

  // Client preferences
  const clientPreferences: string[] = [];
  if (lower.includes("pet")) clientPreferences.push("pet-friendly");
  if (lower.includes("child") || lower.includes("kid") || lower.includes("baby")) clientPreferences.push("child-safe");
  if (lower.includes("wheelchair") || lower.includes("accessible") || lower.includes("ada")) clientPreferences.push("wheelchair accessible");
  if (lower.includes("low maintenance") || lower.includes("easy care")) clientPreferences.push("low maintenance");
  if (lower.includes("sustainable") || lower.includes("eco") || lower.includes("green")) clientPreferences.push("sustainable");

  return {
    projectType, style, budget, timeline,
    providedAssets, requiredDeliverables,
    materials, lighting, dimensions, clientPreferences,
  };
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limit request body size (1MB)
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 1_048_576) {
      return new Response(
        JSON.stringify({ error: "Request body too large (max 1MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { brief, conversation_history, toolDefinitions } = await req.json();

    if (!brief || typeof brief !== "string" || brief.length > 10_000) {
      throw new Error("Missing or invalid 'brief' field (max 10,000 characters)");
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // If no API key, use enhanced regex fallback
    if (!openaiKey) {
      console.warn("OPENAI_API_KEY not set — using regex-based brief analysis");
      const analysis = analyzeWithRegex(brief);
      return new Response(
        JSON.stringify({
          success: true,
          analysis,
          engine: "regex-fallback (set OPENAI_API_KEY for LLM analysis)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for the LLM
    const hasTools = Array.isArray(toolDefinitions) && toolDefinitions.length > 0;
    const toolPlanningAddendum = hasTools
      ? `\n\nYou also have access to the following tools that can be invoked:\n${JSON.stringify(toolDefinitions, null, 2)}\n\nIn addition to the analysis JSON, include an "executionPlan" field: an ordered array of { "tool": "<tool_name>", "params": { ... }, "rationale": "<why this tool>" } steps that should be executed to fulfill this brief. Only include tools from the list above.`
      : "";

    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT + toolPlanningAddendum },
    ];

    // Include conversation history for richer context (validated)
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        if (typeof msg === "string" && msg.length > 0 && msg.length <= 5000) {
          messages.push({ role: "user", content: msg.slice(0, 5000) });
        }
      }
    }

    messages.push({
      role: "user",
      content: `Analyze this design brief:\n\n${brief}`,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${errText}`);
      // Fall back to regex on API error
      const analysis = analyzeWithRegex(brief);
      return new Response(
        JSON.stringify({
          success: true,
          analysis,
          engine: "regex-fallback (OpenAI API error)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from LLM");
    }

    const parsed = JSON.parse(content);

    // Separate executionPlan from analysis fields
    const { executionPlan, ...analysisFields } = parsed;
    const analysis: BriefAnalysis = analysisFields;

    // Validate required fields and set defaults
    if (!analysis.projectType) analysis.projectType = "residential";
    if (!analysis.timeline) analysis.timeline = "standard";
    if (!Array.isArray(analysis.providedAssets)) analysis.providedAssets = [];
    if (!Array.isArray(analysis.requiredDeliverables) || analysis.requiredDeliverables.length === 0) {
      analysis.requiredDeliverables = ["renders", "shopping"];
    }
    if (!Array.isArray(analysis.materials)) analysis.materials = [];
    if (!Array.isArray(analysis.clientPreferences)) analysis.clientPreferences = [];

    const responseBody: Record<string, unknown> = {
      success: true,
      analysis,
      engine: "gpt-4o-mini",
    };

    // Include execution plan if tool definitions were provided and LLM returned a plan
    if (hasTools && Array.isArray(executionPlan)) {
      responseBody.executionPlan = executionPlan;
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze-brief error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
