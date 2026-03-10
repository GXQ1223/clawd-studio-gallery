import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const { brief } = await req.json();

    if (!brief || typeof brief !== "string") {
      throw new Error("Missing or invalid 'brief' field");
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
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
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
