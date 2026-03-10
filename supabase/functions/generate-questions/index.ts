import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") || (console.warn("CORS_ALLOWED_ORIGIN not set — defaulting to wildcard. Set this in production."), "*");
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a senior interior/architectural design consultant conducting a discovery session with a client. Based on their initial brief, generate 4–6 focused follow-up questions to gather the information needed to produce excellent design renders and product sourcing.

Rules:
- Do NOT ask about anything the brief already clearly answers (e.g. if they said "modern living room", don't ask about room type or style)
- Each question should meaningfully change the generated output — skip trivial or generic questions
- Prioritize questions about: spatial details, functional requirements, material/color preferences, lighting, specific items they want, budget, and any constraints
- Mix question types: use "chips" for common choices, "text" for open-ended specifics
- Keep questions concise and conversational
- For "chips" type, provide 4–7 relevant options
- Always end with one open-ended "text" question for anything you missed

Return a JSON array of question objects with this exact structure:
[
  {
    "id": "unique_snake_case_id",
    "question": "The question text",
    "type": "chips" or "text",
    "options": ["Option 1", "Option 2", ...] // only for "chips" type
  }
]

Respond with ONLY the JSON array, no markdown fences, no explanation.`;

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

    const { brief } = await req.json();

    if (!brief || typeof brief !== "string" || brief.length > 10_000) {
      throw new Error("Missing or invalid 'brief' field (max 10,000 characters)");
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_api_key",
          message: "OPENAI_API_KEY not set — use client-side fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Client's initial brief:\n\n"${brief}"\n\nGenerate contextual follow-up questions.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errText);
      throw new Error("Question generation failed. Please try again.");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty response from LLM");
    }

    // Strip markdown fences if present
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const questions = JSON.parse(content);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid questions format from LLM");
    }

    // Validate each question
    const validated = questions
      .filter(
        (q: { id?: string; question?: string; type?: string }) =>
          q.id && q.question && (q.type === "chips" || q.type === "text")
      )
      .map((q: { id: string; question: string; type: string; options?: string[] }) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        ...(q.type === "chips" && Array.isArray(q.options) ? { options: q.options } : {}),
      }));

    return new Response(
      JSON.stringify({
        success: true,
        questions: validated,
        engine: "gpt-4o-mini",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate-questions error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
