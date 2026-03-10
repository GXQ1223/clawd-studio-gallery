import { supabase } from "@/integrations/supabase/client";
import type { PlanningQuestion } from "@/components/workspace/PlanningQuestions";

/** Generate contextual discovery questions via LLM, with rule-based fallback */
export async function generatePlanningQuestions(brief: string): Promise<PlanningQuestion[]> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-questions", {
      body: { brief },
    });

    if (error) throw error;
    if (!data?.success || !Array.isArray(data?.questions) || data.questions.length === 0) {
      throw new Error("Invalid or empty questions response");
    }

    return data.questions as PlanningQuestion[];
  } catch (err) {
    console.warn("LLM question generation failed, using rule-based fallback:", err);
    return generateFallbackQuestions(brief);
  }
}

/** Synchronous rule-based fallback for when the LLM is unavailable */
export function generateFallbackQuestions(brief: string): PlanningQuestion[] {
  const lower = brief.toLowerCase();
  const questions: PlanningQuestion[] = [];

  // 1. Room / space type — skip if already clearly stated
  const hasRoom = /living room|bedroom|kitchen|bathroom|office|restaurant|lobby|garden|patio|terrace/.test(lower);
  if (!hasRoom) {
    questions.push({
      id: "room",
      question: "What space are you designing?",
      type: "chips",
      options: ["Living Room", "Bedroom", "Kitchen", "Office", "Restaurant", "Outdoor / Landscape", "Other"],
    });
  }

  // 2. Size
  const hasSize = /\d+\s*(sq|ft|m²|sqft|square|x\s*\d)/.test(lower);
  if (!hasSize) {
    questions.push({
      id: "size",
      question: "How large is the space?",
      type: "chips",
      options: ["Small (< 150 sqft)", "Medium (150–400 sqft)", "Large (400–800 sqft)", "Very large (800+ sqft)"],
    });
  }

  // 3. Style — skip if user already specified a clear style
  const hasStyle = /modern|minimalist|japandi|scandinavian|industrial|traditional|bohemian|mid-century|rustic|coastal|art deco/.test(lower);
  if (!hasStyle) {
    questions.push({
      id: "style",
      question: "What style direction appeals to you?",
      type: "chips",
      options: ["Modern / Minimalist", "Warm & Natural", "Industrial / Urban", "Classic / Traditional", "Eclectic / Bohemian", "Scandinavian / Japandi"],
    });
  }

  // 4. Function / usage
  questions.push({
    id: "function",
    question: "What's the primary use of this space?",
    type: "chips",
    options: ["Everyday living", "Entertaining guests", "Work / productivity", "Relaxation & wellness", "Client-facing / commercial"],
  });

  // 5. Budget — skip if already mentioned
  const hasBudget = /\$|budget|k\b|thousand/.test(lower);
  if (!hasBudget) {
    questions.push({
      id: "budget",
      question: "What's your budget range?",
      type: "chips",
      options: ["Under $5k", "$5k – $15k", "$15k – $30k", "$30k – $50k", "$50k+", "No fixed budget"],
    });
  }

  // 6. Special requirements — always ask
  questions.push({
    id: "special",
    question: "Anything specific I should know?",
    type: "text",
  });

  return questions;
}

/** Compose a comprehensive prompt from brief + answers for image generation */
/** Strip control characters and limit length for prompt safety */
function sanitizePromptInput(s: string, maxLen = 2000): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLen);
}

export function composeFinalPrompt(originalBrief: string, answers: Record<string, string>): string {
  const parts: string[] = [sanitizePromptInput(originalBrief, 5000)];

  for (const [key, value] of Object.entries(answers)) {
    if (value) {
      parts.push(`${sanitizePromptInput(key, 200)}: ${sanitizePromptInput(value)}`);
    }
  }

  return parts.join(". ") + ".";
}
